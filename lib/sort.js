// Compare object titles alphabetically (case insensitive)
const compareByTitle = (itemA, itemB) => {
  let titleA = itemA.title.toLowerCase();
  let titleB = itemB.title.toLowerCase();

  if (titleA < titleB) {
    return -1;
  } else if (titleA > titleB) {
    return 1;
  } else {
    return 0;
  }
};

// now refactored into one function, since this module no longer accesses TodoLists or Todo objects
function sortItems(undone, done) {
  undone.sort(compareByTitle);
  done.sort(compareByTitle);
  return [].concat(undone, done);
}

module.exports = {
  // return a list of todo lists or todos sorted by their completion status and title;
  // completed and uncompleted items must be passed to the method via undone and done args
  sortTodoLists: sortItems,
  sortTodos: sortItems
}
