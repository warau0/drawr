import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Slider from '@material-ui/core/Slider';
import IconButton from '@material-ui/core/IconButton';
import PlayIcon from '@material-ui/icons/PlayCircleOutline';
import ClearIcon from '@material-ui/icons/HighlightOff';
import PauseIcon from '@material-ui/icons/PauseCircleOutline';

import FileList from './atoms/fileList/fileList';

import useForceUpdate from './utils/useForceUpdate';
import drawAction from './utils/drawAction';
import drawUntil from './utils/drawUntil';
import throttle from './utils/throttle';
import UnpackGzWorker from './workers/unpackGz.worker';

import './App.css';

const NAVIGATION_DELAY = 100;

let drawingTimer = null; // Current drawing action. Used to cancel drawing upon new selection.
let globalPlaybackSpeed = null; // Global scoped mirror of playbackSpeed. Needed to refresh speed inside recursive loop.
let undoStack = []; // No state needed, just to keep track of what actions have been undone.
let fileList = []; // Updated async from web workers so can't be a state variable.

/**
 * ::::TODO::::
 * 
 * Find out if csize and layers are important.
 * Add reposts to fileList.
 * Sort files based on repost urls.
 * Generate and download images for every frame.
 * Move drawing into a web worker to reduce main thread lag.
 * Cheese it!
 */

function App() {
  // Drawing details
  const [canvasHeight, setCanvasHeight] = useState(570);
  const [canvasWidth, setCanvasWidth] = useState(600);
  const [currentActionIndex, setCurentActionIndex] = useState(0);
  const [paused, setPaused] = useState(true);

  // User input
  const [playbackSpeed, setPlaybackSpeed] = useState(100);
  const [filterUndos, setFilterUndos] = useState(false);

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
        status: 'loading',
      };

      if (existingIndex === -1) {
        fileList.push(canvasFile);
      } else {
        fileList[existingIndex] = canvasFile;
      }
    });
    updateFileList();

    uploadFiles.forEach(file => {
      const unpacker = new UnpackGzWorker();

      const setFileData = e => {
        const fileIndex = fileList.findIndex(file => file.name === e.data.name);
        fileList[fileIndex] = e.data;
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

  const _doAction = useCallback((ctx, actions, index = 0) => {
    switch (actions[index].action) {
      case 'draw': {
        drawAction(ctx, actions[index]);
        break;
      }

      case 'undo': {
        ctx.clearRect(0, 0, canvas.current.width, canvas.current.height);
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

    setCurentActionIndex(index + 1);

    if (index !== actions.length - 1) {
      drawingTimer = setTimeout(() => {
        _doAction(ctx, actions, index + 1);
      }, globalPlaybackSpeed);
    } else {
      setPaused(true);
    }
  }, []);

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
    ctx.clearRect(0, 0, canvas.current.width, canvas.current.height);
  }, [updateFileList]);

  const _togglePause = useCallback(() => {
    if (!canvasActions.length) return;

    clearTimeout(drawingTimer);
    setPaused(!paused);

    if (paused) {
      const ctx = canvas.current.getContext('2d');

      if (currentActionIndex === canvasActions.length) {
        undoStack = [];
        ctx.clearRect(0, 0, canvas.current.width, canvas.current.height);
        _doAction(ctx, canvasActions);
      } else {
        _doAction(ctx, canvasActions, currentActionIndex);
      }
    }
  }, [_doAction, canvasActions, currentActionIndex, paused]);

  const _navigateTo = useCallback((e, index) => {
    clearTimeout(drawingTimer);
    const ctx = canvas.current.getContext('2d');
    ctx.clearRect(0, 0, canvas.current.width, canvas.current.height);

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
              />
              Filter out undos
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
        </div>
      </div>

      {!!(canvasHeight && canvasWidth) && (
        <>
          <div className='progressContainer' style={{ width: canvasWidth }}>
            <IconButton
              color='primary'
              aria-label='Clear'
              onClick={_clearAll}
              disabled={canvasActions.length === 0}
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
