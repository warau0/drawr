import drawAction from './drawAction';

export default (ctx, fileList, file, id, undos) => {
  for (let i = 0; i < fileList.length; i++) {
    if (fileList[i].name !== file) {
      // Redraw every action from previous files.
      const drawActions = fileList[i].actions.filter(action =>
        action.action === 'draw' &&
        undos.findIndex(a => a.id === action.id && a.file === action.file) === -1
      );
      for (let k = 0; k < drawActions.length; k++) {
        drawAction(ctx, drawActions[k]);
      }
    } else {
      // Redraw every action up until given action id.
      const drawActions = fileList[i].actions.filter(action =>
        action.action === 'draw' &&
        undos.findIndex(a => a.id === action.id && a.file === action.file) === -1 &&
        action.id < id
      );
      for (let k = 0; k < drawActions.length - 1; k++) { // Leaves out last draw action.
        drawAction(ctx, drawActions[k]);
      }

      // The next action coming up.
      return drawActions[drawActions.length - 1];
    }
  }
  return null;
};
