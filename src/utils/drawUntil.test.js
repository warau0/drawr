import drawUntil from './drawUntil';

describe ('drawUntil', () => {
  const actions = [
    { action: 'draw', id: 0 },
    { action: 'draw', id: 1 },
    { action: 'draw', id: 2 },
    { action: 'undo', id: 3 },
    { action: 'redo', id: 4 },
    { action: 'draw', id: 5 },
    { action: 'undo', id: 6 },
    { action: 'undo', id: 7 },
    { action: 'draw', id: 8 },
  ];

  it('calls drawing function with actions prior to index', () => {
    const drawMock = jest.fn();
    drawUntil(null, actions, 2, [], drawMock);

    expect(drawMock.mock.calls.length).toEqual(2);
    expect(drawMock.mock.calls[0][1]).toEqual({ action: 'draw', id: 0 });
    expect(drawMock.mock.calls[1][1]).toEqual({ action: 'draw', id: 1 });
  });

  it('respects indexes in undoStack', () => {
    const drawMock = jest.fn();
    drawUntil(null, actions, 6, [1, 2], drawMock);

    expect(drawMock.mock.calls.length).toEqual(1);
    expect(drawMock.mock.calls[0][1]).toEqual({ action: 'draw', id: 0 });
  });
});
