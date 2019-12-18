import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { saveAs } from 'file-saver';
import Slider from '@material-ui/core/Slider';
import IconButton from '@material-ui/core/IconButton';
import Button from '@material-ui/core/Button';
import PlayIcon from '@material-ui/icons/PlayCircleOutline';
import PauseIcon from '@material-ui/icons/PauseCircleOutline';

import FileList from './atoms/fileList/fileList';
import Dropzone from './atoms/dropzone/dropzone';

import useForceUpdate from './utils/useForceUpdate';
import drawAction from './utils/drawAction';
import drawUntil from './utils/drawUntil';
import throttle from './utils/throttle';
import sortFiles from './utils/sortFiles';

import UnpackGzWorker from './workers/unpackGz.worker';
import ZipImagesWorker from './workers/zipImages.worker';
import OffscreenCanvasWorker from './workers/offscreenCanvas.worker';

import './App.css';

const NAVIGATION_DELAY = 100;

let drawingTimer = null; // Current drawing action. Used to cancel drawing upon new selection.
let globalPlaybackSpeed = null; // Global scoped mirror of playbackSpeed. Needed to refresh speed inside recursive loop.
let undoStack = []; // No state needed, just to keep track of what actions have been undone.
let fileList = []; // Updated async from web workers so can't be a state variable.

/**
 * ::::TODO::::
 * 
 * Bug: Manual navigation don't properly apply undos & redos.
 * Use frames for doAction if it's available.
 * Move drawing into a web worker to reduce main thread lag.
 * Kill web workers when clearAll is fired.
 * Find out if csize and layers are important.
 * Cheese it!
 */

function App() {
  // Drawing details
  const [canvasHeight, setCanvasHeight] = useState(570);
  const [canvasWidth, setCanvasWidth] = useState(600);
  const [currentActionIndex, setCurentActionIndex] = useState(0);
  const [paused, setPaused] = useState(true);
  const [zipLoading, setZipLoading] = useState(false);

  // User input
  const [playbackSpeed, setPlaybackSpeed] = useState(100);
  const [filterUndos, setFilterUndos] = useState(false);

  const canvas = useRef(null);

  const updateFileList = useForceUpdate(); // Proxy state updater for fileList.

  const canvasActions = useMemo(() => {
    return [].concat(...fileList.map(file => file.actions));
  }, [updateFileList]); // eslint-disable-line react-hooks/exhaustive-deps

  const undoActionIndexes = useMemo(() => {
    const combinedUndos = [];
    for (let i = 0; i < canvasActions.length; i++) {
      if (canvasActions[i].action === 'undo') {
        combinedUndos.push({ value: i + 1 });
      }
    }
    return combinedUndos;
  }, [canvasActions]);

  const filesUnpacking = useMemo(() => {
    for (let i = 0; i < fileList.length; i++) {
      const status = fileList[i].status;
      if (status === 'unpacking') {
        return true;
      }
    }

    return false;
  }, [updateFileList]); // eslint-disable-line react-hooks/exhaustive-deps

  const filesDrawing = useMemo(() => {
    for (let i = 0; i < fileList.length; i++) {
      const status = fileList[i].status;
      if (status === 'waiting' || status.indexOf('drawing') !== -1) {
        return true;
      }
    }

    return false;
  }, [updateFileList]); // eslint-disable-line react-hooks/exhaustive-deps

  const allFramesDrawn = useMemo(() => {
    if (canvasActions.length === 0) return false;

    for (let i = 0; i < canvasActions.length; i++) {
      if (!canvasActions[i].frame) {
        return false;
      }
    }

    return true;
  }, [canvasActions]);

  // Mirror playbackSpeed to globalPlaybackSpeed.
  useEffect(() => {
    globalPlaybackSpeed = playbackSpeed;
  }, [playbackSpeed]);

  // ------------------------ Functions ------------------------

  /**
   * Unpack and convert .gz files into canvas actions.
   */
  const _onFileUpload = files => {
    clearTimeout(drawingTimer);
    undoStack = [];
    setPaused(true);
    setCurentActionIndex(0);
    
    const uploadFiles = Array.from(files);

    uploadFiles.forEach(file => {
      const existingIndex = fileList.findIndex(f => f.name === file.name);
      const canvasFile = {
        name: file.name,
        actions: [],
        repostUrl: null,
        repostFile: null,
        status: 'unpacking',
      };

      if (existingIndex === -1) {
        fileList.push(canvasFile);
      } else {
        fileList[existingIndex] = canvasFile;
      }
    });
    fileList = sortFiles(fileList);
    updateFileList();

    uploadFiles.forEach(file => {
      const unpacker = new UnpackGzWorker();

      const setFileData = e => {
        const fileIndex = fileList.findIndex(file => file.name === e.data.name);
        fileList[fileIndex] = e.data;

        if (e.data.repostFile && fileList.findIndex(f => f.name === e.data.repostFile) === -1) {
          // Insert repost before the file relying on the repost.
          fileList.splice(fileIndex, 0, {
            name: e.data.repostFile,
            actions: [],
            repostUrl: null,
            repostFile: null,
            status: 'missing',
          });
        }

        updateFileList();

        if (e.data.dimensions) {
          setCanvasWidth(e.data.dimensions.width);
          setCanvasHeight(e.data.dimensions.height);
        }

        unpacker.removeEventListener('message', setFileData);
        unpacker.terminate();
      };

      unpacker.addEventListener('message', setFileData, false);
      unpacker.postMessage({ file, filterUndos });
    });
  };

  const _generateFrames = (fileIndex = 0, undos = []) => {
    if (!fileIndex) {
      fileList = fileList.map(f => ({ ...f, status: (f.status === 'ready' ? 'waiting' : f.status) }));
      updateFileList();
    }

    const file = fileList[fileIndex];
    if (file.status === 'waiting') {
      const drawer = new OffscreenCanvasWorker();

      const setActions = e => {
        const fileIndex = fileList.findIndex(file => file.name === e.data.name);

        if (e.data.i) {
          fileList[fileIndex].status = `drawing (${parseInt(e.data.i / e.data.max * 100, 10)}%)`;
          updateFileList();
          return;
        }

        fileList[fileIndex].actions = e.data.actions;
        fileList[fileIndex].status = 'ready';

        undos = e.data.undoStack;

        updateFileList();

        drawer.removeEventListener('message', setActions);
        drawer.terminate();

        if (fileIndex !== fileList.length - 1) {
          _generateFrames(fileIndex + 1, undos);
        }
      };

      drawer.addEventListener('message', setActions, false);
      drawer.postMessage({
        name: file.name,
        actions: file.actions,
        canvasDimensions: { height: canvasHeight, width: canvasWidth },
        prevActions: [].concat(...fileList.slice(0, fileIndex).map(file => file.actions)),
        undoStack: undos,
      });
    } else {
      if (fileIndex !== fileList.length - 1) {
        _generateFrames(fileIndex + 1, undos);
      }
    }
  }

  /**
   * Act upon an action by updating the canvas.
   */
  const _doAction = useCallback((ctx, actions, index = 0) => {
    switch (actions[index].action) {
      case 'draw': {
        drawAction(ctx, actions[index]);
        break;
      }

      case 'undo': {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.current.width, canvas.current.height);
        drawUntil(ctx, actions, index, undoStack); // Scales badly, lags when going fast.
        for (let i = index; i >= 0; i--) {
          if (actions[i].action === 'draw' && undoStack.indexOf(i) === -1) {
            undoStack.push(i);
            break;
          }
        }
        break;
      }

      case 'redo': {
        const redoActionIndex = undoStack.pop();
        if (redoActionIndex >= 0) {
          const undoneAction = actions[redoActionIndex];
          if (undoneAction) {
            drawAction(ctx, undoneAction);
          } else {
            console.warn('Redo action doesn\'t exist.')
          }
        } else {
          console.warn('Redo action but no correlated undo.');
        }
        break;
      }

      default: console.warn('Unknown action', actions[index].action); break;
    }

    setCurentActionIndex(index + 1);

    if (index !== actions.length - 1) {
      drawingTimer = setTimeout(() => {
        _doAction(ctx, actions, index + 1);
      }, globalPlaybackSpeed);
    } else {
      setPaused(true);
    }
  }, []);

  /**
   * Clear the canvas and remove all uploaded files. 
   */
  const _clearAll = useCallback(() => {
    clearTimeout(drawingTimer);
    undoStack = [];
    fileList = [];
    updateFileList();
    setPaused(true);
    setCurentActionIndex(0);
    setCanvasHeight(570);
    setCanvasWidth(600);

    const ctx = canvas.current.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.current.width, canvas.current.height);
  }, [updateFileList]);

  /**
   * Pause or unpause the drawing playback.
   */
  const _togglePause = useCallback(() => {
    if (!canvasActions.length) return;

    clearTimeout(drawingTimer);
    setPaused(!paused);

    if (paused) {
      const ctx = canvas.current.getContext('2d');

      const startingIndex = currentActionIndex === canvasActions.length ? 0 : currentActionIndex;
      if (!startingIndex) {
        undoStack = [];
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.current.width, canvas.current.height);
      }

      _doAction(ctx, canvasActions, startingIndex);
    }
  }, [_doAction, canvasActions, currentActionIndex, paused]);

  /*
   * Jump to a point in the drawing timeline.
   */
  const _navigateTo = useCallback((e, index) => {
    clearTimeout(drawingTimer);
    const ctx = canvas.current.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.current.width, canvas.current.height);

    // Rebuild undo stack.
    undoStack = [];
    for (let i = 0; i < index; i++) {
      if (canvasActions[i].action === 'undo') {
        // Find the last drawing action before this undo.
        for (let j = i; j >= 0; j--) {
          if (canvasActions[j].action === 'draw' && undoStack.indexOf(i) === -1) {
            undoStack.push(j);
            break;
          }
        }
      } else if (canvasActions[i].action === 'redo') {
        undoStack.pop();
      }
    }

    drawUntil(ctx, canvasActions, index, undoStack);

    if (!paused) {
      _doAction(ctx, canvasActions, index);
    } else {
      setCurentActionIndex(index);
    }
  }, [_doAction, canvasActions, paused]);

  const _throttledNavigateTo = useCallback((...args) => {
    throttle(() => _navigateTo(...args), NAVIGATION_DELAY);
  }, [_navigateTo]);

  const _downloadImageFrames = () => {
    const packer = new ZipImagesWorker();
    setZipLoading(true);

    const downloadFile = e => {
      if (e.data) {
        saveAs(e.data, `${fileList[fileList.length - 1].name.split('.')[0]}.zip`);
      }
      
      setZipLoading(false);
      packer.removeEventListener('message', downloadFile);
      packer.terminate();
    };
    
    packer.addEventListener('message', downloadFile, false);
    packer.postMessage(canvasActions);
  }

  return (
    <div className='app' style={{ width: canvasWidth }}>
      <div className='header'>
        <div className='uploadContainer'>
          <div>
            <Dropzone
              disabled={!paused}
              onFilesAdded={_onFileUpload}
            />
          </div>

          <div className='checkboxContainer'>
            <label>
              <input
                type='checkbox'
                onChange={() => setFilterUndos(!filterUndos)}
                checked={filterUndos}
                disabled={!paused}
              />
              Remove undos when unpacking
            </label>
          </div>

          <FileList files={fileList} />
        </div>

        <div className='actionsContainer'>
          <Button
            variant='outlined'
            onClick={_clearAll}
            disabled={fileList.length === 0 || !paused}
          >
            Clear files
          </Button>

          <Button
            color='primary'
            variant='contained'
            onClick={() => _generateFrames()}
            disabled={fileList.length === 0 || filesDrawing || allFramesDrawn}
          >
            Generate video frames
          </Button>
          <Button
            color='primary'
            variant='contained'
            onClick={_downloadImageFrames}
            disabled={zipLoading || fileList.length === 0 || filesDrawing || !allFramesDrawn}
          >
            {zipLoading ? 'Generating zip...' : 'Download frames'}
          </Button>

          <div className='speedContainer'>
            <label>
              Playback speed (ms)
              <Slider
                onChange={(e, value) => setPlaybackSpeed(value)}
                value={playbackSpeed}
                valueLabelDisplay='auto'
                step={10}
                min={10}
                max={500}
              />
            </label>
          </div>
        </div>
      </div>

      <div className='progressContainer'>
        <IconButton
          color='primary'
          aria-label='Pause'
          onClick={_togglePause}
          disabled={canvasActions.length === 0 || filesUnpacking}
        >
          {paused ? <PlayIcon /> : <PauseIcon />}
        </IconButton>

        {canvasActions.length > 0 && (
          <>
            <span className='indicatorLeft'>{0}</span>
            <Slider
              onChange={_throttledNavigateTo}
              value={currentActionIndex}
              step={1}
              min={0}
              max={canvasActions.length - 1}
              marks={undoActionIndexes}
              valueLabelDisplay='auto'
            />
            <span className='indicatorRight'>{canvasActions.length - 1}</span>
          </>
        )}
      </div>

      <div className='canvasContainer' style={{ height: canvasHeight }}>
        <canvas ref={canvas} height={canvasHeight} width={canvasWidth} />
      </div>
    </div>
  );
}

export default App;
