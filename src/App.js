import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { saveAs } from 'file-saver';
import Slider from '@material-ui/core/Slider';
import IconButton from '@material-ui/core/IconButton';
import Button from '@material-ui/core/Button';
import PlayIcon from '@material-ui/icons/PlayCircleOutline';
import ClearIcon from '@material-ui/icons/HighlightOff';
import PauseIcon from '@material-ui/icons/PauseCircleOutline';

import FileList from './atoms/fileList/fileList';

import useForceUpdate from './utils/useForceUpdate';
import drawAction from './utils/drawAction';
import drawUntil from './utils/drawUntil';
import throttle from './utils/throttle';
import sortFiles from './utils/sortFiles';
import UnpackGzWorker from './workers/unpackGz.worker';
import ZipImagesWorker from './workers/zipImages.worker';

import './App.css';

const NAVIGATION_DELAY = 100;

let drawingTimer = null; // Current drawing action. Used to cancel drawing upon new selection.
let globalPlaybackSpeed = null; // Global scoped mirror of playbackSpeed. Needed to refresh speed inside recursive loop.
let undoStack = []; // No state needed, just to keep track of what actions have been undone.
let fileList = []; // Updated async from web workers so can't be a state variable.
let imgStack = [];

/**
 * ::::TODO::::
 * 
 * Bug: Manual navigation don't properly apply undos & redos.
 * Move image data from imgStack into individual actions.
 * Use imgStack for undos & redos if it's available.
 * Move drawing into a web worker to reduce main thread lag.
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
  const [generateFrames, setGenerateFrames] = useState(false);

  const inputRef = useRef(null);
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

  const loadingFilesCount = useMemo(() => fileList.filter(f => f.status === 'loading').length,
    [updateFileList]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mirror playbackSpeed to globalPlaybackSpeed.
  useEffect(() => {
    globalPlaybackSpeed = playbackSpeed;
  }, [playbackSpeed]);

  // ------------------------ Functions ------------------------

  /**
   * Unpack and convert .gz files into canvas actions.
   */
  const _onFileUpload = event => {
    clearTimeout(drawingTimer);
    
    const uploadFiles = Array.from(event.target.files);
    inputRef.current.value = '';

    uploadFiles.forEach(file => {
      const existingIndex = fileList.findIndex(f => f.name === file.name);
      const canvasFile = {
        name: file.name,
        actions: [],
        undos: [],
        repostUrl: null,
        repostFile: null,
        status: 'loading',
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
            undos: [],
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
        let lastDrawingIndex = null;
        for (let i = index; i >= 0; i--) {
          if (actions[i].action === 'draw' && undoStack.indexOf(i) === -1) {
            lastDrawingIndex = i;
            break;
          }
        }
        undoStack.push(lastDrawingIndex);
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

    if (generateFrames) {
      imgStack[index] = canvas.current.toDataURL()
        .split('data:image/png;base64,')[1];
    }

    setCurentActionIndex(index + 1);

    if (index !== actions.length - 1) {
      drawingTimer = setTimeout(() => {
        _doAction(ctx, actions, index + 1);
      }, globalPlaybackSpeed);
    } else {
      setPaused(true);
    }
  }, [generateFrames]);

  /**
   * Clear the canvas and remove all uploaded files. 
   */
  const _clearAll = useCallback(() => {
    clearTimeout(drawingTimer);
    undoStack = [];
    imgStack = [];
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
        imgStack = [];
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

  const _downloadImgStack = () => {
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
    packer.postMessage(imgStack);
  }

  return (
    <>
      <div className='header'>
        <div className='uploadContainer'>
          <div>
            <input
              multiple
              ref={inputRef}
              type='file'
              name='file'
              onChange={_onFileUpload}
              disabled={!paused}
            />
          </div>

          <div>
            <label>
              <input
                type='checkbox'
                onChange={() => setFilterUndos(!filterUndos)}
                checked={filterUndos}
                disabled={!paused}
              />
              Filter out undos
            </label>
          </div>

          <div>
            <label>
              <input
                type='checkbox'
                onChange={() => setGenerateFrames(!generateFrames)}
                checked={generateFrames}
                disabled={!paused}
              />
              Generate image frames
            </label>
          </div>

          <FileList files={fileList} />
        </div>

        <div className='speedContainer'>
          <div>
            <label>
              Time (ms) per frame
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

          <div>Playback time: {(canvasActions.length * playbackSpeed / 1000).toFixed(2)}s</div>
          <div>Frames: {canvasActions.length}</div>
          {generateFrames && <Button
            color='primary'
            variant='contained'
            onClick={_downloadImgStack}
            disabled={imgStack.length === 0 || imgStack.length !== canvasActions.length}
          >
            {zipLoading ? 'Generating zip...' : 'Download frames'}
          </Button>}
        </div>
      </div>

      {!!(canvasHeight && canvasWidth) && (
        <>
          <div className='progressContainer' style={{ width: canvasWidth }}>
            <IconButton
              color='primary'
              aria-label='Clear'
              onClick={_clearAll}
              disabled={fileList.length === 0 || loadingFilesCount > 0}
            >
              <ClearIcon />
            </IconButton>

            <IconButton
              className='playButton'
              color='primary'
              aria-label='Pause'
              onClick={_togglePause}
              disabled={canvasActions.length === 0 || loadingFilesCount > 0}
            >
              {paused ? <PlayIcon /> : <PauseIcon />}
            </IconButton>

            {canvasActions.length > 0 && (
              <Slider
                onChange={_throttledNavigateTo}
                value={currentActionIndex}
                step={1}
                min={0}
                max={canvasActions.length - 1}
                marks={undoActionIndexes}
              />
            )}
          </div>

          <div className='canvasContainer' style={{ height: canvasHeight }}>
            <canvas ref={canvas} height={canvasHeight} width={canvasWidth} />
          </div>
        </>
      )}
    </>
  );
}

export default App;
