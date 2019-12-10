import React, { useState, useRef, useEffect, useCallback } from 'react';
import Slider from '@material-ui/core/Slider';
import IconButton from '@material-ui/core/IconButton';
import PlayIcon from '@material-ui/icons/PlayCircleOutline';
import ReplayIcon from '@material-ui/icons/Replay';
import PauseIcon from '@material-ui/icons/PauseCircleOutline';

import unpackGz from './utils/unpackGz';
import amfToCanvasActions from './utils/amfToCanvasActions';
import sortFilenames from './utils/sortFilenames';

import drawAction from './drawing/drawAction';

import './App.css';

let drawingTimer = null; // Current drawing action. Used to cancel drawing upon new selection.
let drawingSpeed = null; // Global scoped mirror of playbackSpeed. Needed to refresh speed inside recursive loop.
let undoStack = [];

function App() {
  // Drawing details
  const [canvasHeight, setCanvasHeight] = useState(null);
  const [canvasWidth, setCanvasWidth] = useState(null);
  const [canvasActions, setCanvasActions] = useState([]);
  const [currentActionIndex, setCurentActionIndex] = useState(null);
  const [undoActionIndexes, setUndoActionIndexes] = useState([]);
  const [paused, setPaused] = useState(false);

  // User input
  const [playbackSpeed, setPlaybackSpeed] = useState(100);
  const [filterUndos, setFilterUndos] = useState(false);

  const inputRef = useRef(null);

  const _onFileUpload = event => {
    clearTimeout(drawingTimer);
    undoStack = [];

    setCanvasHeight(null);
    setCanvasWidth(null);
    setCanvasActions([]);
    setCurentActionIndex(null);

    const promises = [];
    Array.from(event.target.files)
      .sort(sortFilenames)
      .forEach(file => {
        console.log('Unpacking', `${file.name}...`);

        promises.push(unpackGz(file))
      });
    inputRef.current.value = '';

    Promise.all(promises)
    .then((results) => {
      console.log('Analyzing file data...');

      let combinedActions = [];
      let canvasSize = {
        height: 600,
        width: 570,
      };

      results.forEach((result, index) => {
        const {
          dimensions,
          actions,
          //TODO: repostUrl,
        } = amfToCanvasActions(result, combinedActions.length, filterUndos);

        if (dimensions) canvasSize = dimensions;
        combinedActions = combinedActions.concat(actions);
      });

      setCanvasHeight(canvasSize.height);
      setCanvasWidth(canvasSize.width);
      setCanvasActions(combinedActions);
      setUndoActionIndexes(combinedActions.filter(a => a.action === 'undo').map(a => ({ value: a.id })));
      if (combinedActions.length) {
        setTimeout(() => {
          console.log('Begin drawing.');
          const canvas = document.getElementById('canvas');
          const ctx = canvas.getContext('2d');
          setPaused(false);
          _doAction(canvas, ctx, combinedActions);
        });
      } else {
        console.log('No drawing data.');
      }
    })
    .catch((e) => console.error('Bad input!', e));
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

  // Mirror playbackSpeed to drawingSpeed global.
  useEffect(() => {
    drawingSpeed = playbackSpeed;
  }, [playbackSpeed]);

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

          <div>Playback time: {(canvasActions.length * playbackSpeed / 1000).toFixed(2)}s</div>
        </div>
      </div>

      {!!(canvasHeight && canvasWidth) && (
        <>
          <div className='progressContainer' style={{ width: canvasWidth }}>
            <IconButton color='primary' aria-label='Pause' onClick={_togglePause}>
              {paused ? <PlayIcon /> : <PauseIcon />}
            </IconButton>

            <IconButton color='primary' aria-label='Replay' onClick={_replayDrawing} className='replayButton'>
              <ReplayIcon />
            </IconButton>

            {currentActionIndex && (
              <Slider
                // onChange={(e, value) => console.log(value)} // TODO: Navigate through replay
                value={currentActionIndex}
                step={1}
                min={0}
                max={canvasActions.length}
                marks={undoActionIndexes}
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
