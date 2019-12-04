import React, { useState, useEffect, useRef } from 'react';

import unpackGz from './utils/unpackGz';
import amfToCanvasActions from './utils/amfToCanvasActions';

import drawAction from './drawing/drawAction';

import './App.css';

function App() {
  const [canvasActions, setCanvasActions] = useState([]);
  const [canvasHeight, setCanvasHeight] = useState(null);
  const [canvasWidth, setCanvasWidth] = useState(null);
  const [currentActionIndex, setCurentActionIndex] = useState(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(20); // 300-ish fits drawr player default

  const inputRef = useRef(null);

  // Unzip and decode .gz file and set amf actions to state.
  const _onFileUpload = event => {
    setCanvasActions([]);
    setCanvasHeight(null);
    setCanvasWidth(null);
    setCurentActionIndex(null);
    
    const promises = [];
    const fileOrder = [];
    Array.from(event.target.files)
      .sort((a, b) => a.name.toLowerCase().replace('_', '').localeCompare(b.name.toLowerCase().replace('_', '')))
      .forEach(file => {
        console.log('Unpacking', `${file.name}...`);
        promises.push(unpackGz(file))
        fileOrder.push(file.name);
      });
    inputRef.current.value = '';

    // Slow -- waiting for all files to be unpacked before starting to build actions.
    Promise.all(promises)
      .then((results) => {
        let combinedActions = [];
        let canvasSize = null;

        results.forEach((result, index) => {
          const {
            dimensions,
            actions,
            repostUrl,
          } = amfToCanvasActions(result, combinedActions.length);

          if (dimensions) canvasSize = dimensions;
          if (repostUrl) fileOrder.unshift(repostUrl); // TODO: Wiggle in repost in right position.
          combinedActions = combinedActions.concat(actions);
        });

        if (canvasSize) {
          setCanvasHeight(canvasSize.height);
          setCanvasWidth(canvasSize.width);
        }
        setCanvasActions(combinedActions);
      })
      .catch((e) => console.error('Bad input!', e));
  };

  useEffect(() => {
    if (canvasActions.length) {
      console.log('Start drawing canvas actions...');

      const canvas = document.getElementById('canvas');
      const ctx = canvas.getContext('2d');
      const actions = canvasActions;
      const undoStack = [];

      // TODO: Make drawing async instead of scheduled with timeouts.
      for (let i = 0; i < actions.length; i++) {
        setTimeout(() => {
          switch (actions[i].action) {
            case 'draw': {
              drawAction(ctx, actions[i]);
              break;
            }
            case 'undo': { // TODO: Can probably be prettified / optimized.
              // Clear the canvas.
              ctx.clearRect(0, 0, canvas.width, canvas.height);

              // Redraw everything up until action to undo. Gets choppy when undo happens thousands of actions in.
              const drawActions = actions.filter(a => a.action === 'draw' && undoStack.indexOf(a.id) === -1 && a.id <= i);
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
            default: console.warn('Unknown action', actions[i].action); break;
          }

          if (i % 49 === 0 || i === actions.length - 1) {
            setCurentActionIndex(i + 1);
          }

          if (i === actions.length - 1) {
            console.log('Done drawing.')
          }
        }, playbackSpeed * i);
      }
    }
  }, [canvasActions, playbackSpeed]);

  return (
    <div>
      <div className='header'>
        <input multiple ref={inputRef} type='file' name='file' onChange={_onFileUpload}/>
        <div>
          <input type='number' onChange={e => setPlaybackSpeed(e.target.value)} value={playbackSpeed} />
          <div>Canvas Actions: {canvasActions.length}</div>
          <div>Playback time: {(canvasActions.length * playbackSpeed / 1000).toFixed(2)}s</div>
          {currentActionIndex && <div>Action: {currentActionIndex}/{canvasActions.length}</div>}
        </div>
      </div>

      {!!(canvasHeight && canvasWidth) && (
        <div className='canvasContainer' style={{ height: canvasHeight }}>
          <canvas id='canvas' height={canvasHeight} width={canvasWidth} />
        </div>
      )}
    </div>
  );
}

export default App;
