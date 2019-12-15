import sortFiles from './sortFiles';

describe ('sortFiles', () => {
  it('Handles empty arrays', () => {
    const files = [];
    const sortedFiles = sortFiles(files);
    expect(sortedFiles).toEqual([]);
  });

  it('Handles single item arrays', () => {
    const files = [{ id: 1, name: '48e3809cpr9EdUc2.gz', repostFile: null }];

    const sortedFiles = sortFiles(files);
    expect(sortedFiles.map(f => f.id)).toEqual([1]);
  });

  it('Sorts files without touching input array', () => {
    const files = [
      { id: 2, name: '48e3809cpr9EdUc2.gz', repostFile: null },
      { id: 6, name: '49638801Rh2Z6PXb.gz', repostFile: null },
      { id: 4, name: '48e8a283ngG7TEac.gz', repostFile: null },
      { id: 1, name: '5066fa08spTXRkL1.gz', repostFile: null },
      { id: 3, name: '48e8b881nfh2JrjK.gz', repostFile: null },
      { id: 5, name: '4903264ckHpzsDX6.gz', repostFile: null },
    ];

    const sortedFiles = sortFiles(files);
    expect(files.map(f => f.id)).toEqual([2, 6, 4, 1, 3, 5]);
    expect(sortedFiles.map(f => f.id)).toEqual([2, 4, 3, 5, 6, 1]);
  });

  it('Sorts file chains', () => {
    const files = [
      { id: 6, name: '57a5e4aaMdt8QiTy_3.gz', repostFile: null },
      { id: 1, name: '516ff475dApE3yk1_1.gz', repostFile: null },
      { id: 2, name: '516ff475dApE3yk1_2.gz', repostFile: null },
      { id: 5, name: '48e8b881nfh2JrjK.gz', repostFile: null },
      { id: 9, name: '5066fa08spTXRkL1.gz', repostFile: null },
      { id: 3, name: '516ff475dApE3yk1.gz', repostFile: null },
      { id: 7, name: '57a5e4aaMdt8QiTy.gz', repostFile: null },
      { id: 8, name: '48e8b881nfh2JrjK_1.gz', repostFile: null },
      { id: 4, name: '4903264ckHpzsDX6.gz', repostFile: null },
    ];

    const sortedFiles = sortFiles(files);
    expect(sortedFiles.map(f => f.id)).toEqual([5, 8, 4, 9, 3, 1, 2, 7, 6]);
  });
});
