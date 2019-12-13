import React, { useState, useRef, useEffect, useCallback } from 'react';
import Slider from '@material-ui/core/Slider';
import IconButton from '@material-ui/core/IconButton';
import PlayIcon from '@material-ui/icons/PlayCircleOutline';
import ReplayIcon from '@material-ui/icons/Replay';
import PauseIcon from '@material-ui/icons/PauseCircleOutline';

import drawAction from './utils/drawAction';
import WebWorker from './workers/workerSetup';
import unpackGzWorker from './workers/unpackGz';

import './App.css';

let drawingTimer = null; // Current drawing action. Used to cancel drawing upon new selection.
let drawingSpeed = null; // Global scoped mirror of playbackSpeed. Needed to refresh speed inside recursive loop.
let undoStack = [];

const unpacker = new WebWorker(unpackGzWorker);

function App() {
  // Drawing details
  const [canvasHeight, setCanvasHeight] = useState(570);
  const [canvasWidth, setCanvasWidth] = useState(600);
  const [currentActionIndex, setCurentActionIndex] = useState(null);
  const [paused, setPaused] = useState(true);
  const [fileList, setFileList] = useState([]);

  // User input
  const [playbackSpeed, setPlaybackSpeed] = useState(100);
  const [filterUndos, setFilterUndos] = useState(false);

  const inputRef = useRef(null);

  useState(() => {
    console.log('register msg event');
    unpacker.addEventListener('message', e => {
      console.log('event', e.data);
    }, false);
  });

  const _onFileUpload = event => {
    clearTimeout(drawingTimer);
    undoStack = [];

    const files = Array.from(event.target.files);
    inputRef.current.value = '';

    const newFileList = fileList.concat(files.map(file => ({
      name: file.name,
      actions: [],
      undos: [],
      repostUrl: null,
      status: 'loading',
    })));
    setFileList(newFileList);

    files.forEach(file => unpacker.postMessage({ file, filterUndos }));

    /* files.forEach(file => unpackGz(file)
      .then(result => {
        const {
          dimensions,
          actions,
          repostUrl,
        } = amfToCanvasActions(result, filterUndos);
        const undos = actions.filter(a => a.action === 'undo').map(a => ({ value: a.id }));

        const fileIndex = newFileList.findIndex(f => f.name === file.name);
        newFileList[fileIndex] = {
          ...newFileList[fileIndex],
          actions,
          undos,
          repostUrl,
          status: actions.length ? 'ready' : 'empty',
        };

        if (dimensions) {
          setCanvasHeight(dimensions.height);
          setCanvasWidth(dimensions.width);
          console.log(dimensions);
        }
        setFileList(newFileList);
      })
      .catch((e) => {
        console.error('Bad input!', e);
        const fileIndex = newFileList.findIndex(f => f.name === file.name);
        newFileList[fileIndex] = { ...newFileList[fileIndex], status: 'error' };
        setFileList(newFileList);
      })
    ); */
  };

  const _doAction = useCallback((canvas, ctx, actions, index = 0) => {
    switch (actions[index].action) {
      case 'draw': {
        drawAction(ctx, actions[index]);
        break;
      }

      case 'undo': {
        // Clear the canvas.
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Redraw everything up until action to undo. Gets choppy when undo happens thousands of actions in.
        const drawActions = actions.filter(a => a.action === 'draw' && undoStack.indexOf(a.id) === -1 && a.id <= index);
        for (let k = 0; k < drawActions.length - 1; k++) { // Leaves out last draw action.
          drawAction(ctx, drawActions[k]);
        }

        // Push ID into undo stack in order to not undo the same action again unless it's first redone.
        // Redo action also needs to know the order of undos.
        undoStack.push(drawActions[drawActions.length - 1].id);
        break;
      }

      case 'redo': {
        const redoActionID = undoStack.pop();
        if (redoActionID) {
          const undoneAction = actions.find(a => a.id === redoActionID);
          drawAction(ctx, undoneAction);
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
        _doAction(canvas, ctx, actions, index + 1);
      }, drawingSpeed);
    } else {
      setPaused(true);
      console.log('Done drawing.');
    }
  }, []);

  /*
  const _replayDrawing = useCallback(() => {
    clearTimeout(drawingTimer);
    undoStack = [];
    setCurentActionIndex(null);
    setPaused(false);
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setTimeout(() => {
      console.log('Begin drawing.');
      _doAction(canvas, ctx, canvasActions);
    });
  }, [_doAction, canvasActions]);

  const _togglePause = useCallback(() => {
    if (paused) {
      if (currentActionIndex === canvasActions.length) {
        _replayDrawing();
      } else {
        console.log('Unpaused drawing.');
        const canvas = document.getElementById('canvas');
        const ctx = canvas.getContext('2d');
        setPaused(false);
        _doAction(canvas, ctx, canvasActions, currentActionIndex);
      }
    } else {
      console.log('Paused drawing.');
      clearTimeout(drawingTimer);
      setPaused(true);
    }
  }, [_doAction, _replayDrawing, canvasActions, currentActionIndex, paused]);
  */

  // Mirror playbackSpeed to drawingSpeed global.
  useEffect(() => {
    drawingSpeed = playbackSpeed;
  }, [playbackSpeed]);

  const actionsCount = fileList.reduce((a,b) => a + b.actions.length, 0);

  return (
    <>
      <div className='header'>
        <div>
          <div>
            <input multiple ref={inputRef} type='file' name='file' onChange={_onFileUpload}/>
          </div>

          <div>
            <label>
              <input type='checkbox' onChange={e => setFilterUndos(!filterUndos)} checked={filterUndos} />
              Filter out undo actions
            </label>
          </div>

          <div>
            {fileList.map((file) => (
              <div key={file.name}>{file.name}: {file.status} ({file.actions.length})</div>
            ))}
          </div>
        </div>

        <div className='speedContainer'>
          <div>
            <label>
              Latency per line (ms)
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

          <div>Playback time: {(actionsCount * playbackSpeed / 1000).toFixed(2)}s</div>
        </div>
      </div>

      {!!(canvasHeight && canvasWidth) && (
        <>
          <div className='progressContainer' style={{ width: canvasWidth }}>
            <IconButton color='primary' aria-label='Pause' /* onClick={_togglePause}*/ >
              {paused ? <PlayIcon /> : <PauseIcon />}
            </IconButton>

            <IconButton color='primary' aria-label='Replay' /* onClick={_replayDrawing} */ className='replayButton'>
              <ReplayIcon />
            </IconButton>

            {currentActionIndex && (
              <Slider
                // onChange={(e, value) => console.log(value)} // TODO: Navigate through replay
                value={currentActionIndex}
                step={1}
                min={0}
                max={actionsCount}
                // marks={undoActionIndexes}
              />
            )}
          </div>
          <div className='canvasContainer' style={{ height: canvasHeight }}>
            <canvas id='canvas' height={canvasHeight} width={canvasWidth} />
          </div>
        </>
      )}
    </>
  );
}

export default App;
