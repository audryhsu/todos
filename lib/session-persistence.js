const SeedData = require('./seed-data');
const deepCopy = require('./deep-copy');
const { sortTodoLists, sortTodos } = require('./sort');
const nextId = require("./next-id");

module.exports = class SessionPersistence {
  constructor(session) {
    this._todoLists = session.todoLists || deepCopy(SeedData); // reference to session store saved as a private property
    session.todoLists = this._todoLists;
  }

  // Creates a new todoList
  createNewTodoList(todoListTitle) {
    if (this.existsTodoListTitle(todoListTitle)) {
      return false;
    }
    this._todoLists.push({
      id: nextId(),
      title: todoListTitle,
      todos: []
    });
    return true;
  }

  // Returns true if new todoListTitle is duplicate of another existing title
  existsTodoListTitle(todoListTitle) {
    return this._todoLists.some(todoList => todoList.title === todoListTitle)
  }

  setListTitle(todoListId, title) {
    let todoList = this._findTodoList(todoListId)
    if (!todoList) return false;

    todoList.title = title;
    return true;
  }

  deleteTodoList(todoListId) {
    let index = this._todoLists.findIndex(lists => list.id === todoListId)
    if (index === -1 ) return false;

    this._todoLists.splice(index, 1)
    return true;
  }

  createTodo(title, todoListId) {
    let todoList = this._findTodoList(todoListId)
    if (!todoList) return false

    todoList.todos.push({
      id: nextId(),
      title: title,
      done: false,
    });
    return true;
  }

  completeAllTodos(todoListId) {
    let todoList = this._findTodoList(todoListId)
    if (!todoList) return false;

    todoList.todos.forEach((todo, i) => {
      todo.done = true;
    });
    return true;
  }

  // Removes a todo from the todoList, takes in a numeric todo id
  removeTodo(todoListId, todoId) {
    let todoList = this._findTodoList(todoListId)
    if (!todoList) return false;

    let index = todoList.todos.findIndex(todo => todo.id === todoId);
    if (index === -1) return false;

    todoList.todos.splice(index, 1);
    return true;

  }
  // Toggles todo completion status; Returns boolean value if todo is found.
  toggleDoneTodo(todoListId, todoId) {
    let todo = this._findTodo(todoListId, todoId)
    if (!todo) return false;

    todo.done = !todo.done; // toggle y and n
    return true;
  }

  // returns a reference to todoList, or undefined if not found
  _findTodoList(todoListId) {
    return this._todoLists.find(list => list.id === todoListId)
  }

  // returns a reference to todo, or undefined if not found
  _findTodo(todoListId, todoId) {
    let todoList = this._findTodoList(todoListId)
    if (!todoList) return undefined;

    return todoList.todos.find(todo => todo.id === todoId);
  }
  // Find a todo with the indicated ID in the indicated todo list. Returns
  // `undefined` if not found. Note that both `todoListId` and `todoId` must be
  // numeric.
  loadTodo(todoListId, todoId) {
    let todo = this._findTodo(todoListId, todoId);
    return deepCopy(todo);
  }

  // Find a todo list with the indicated ID. Returns `undefined` if not found.
  // Note that `todoListId` must be numeric.
  loadTodoList(todoListId) {
    let todoList = this._findTodoList(todoListId);
    return deepCopy(todoList);
  }

  // Are all of the todos in the todo list done? If the todo list has at least
  // one todo and all of its todos are marked as done, then the todo list is
  // done. Otherwise, it is undone.
  isDoneTodoList(todoList) {
    return todoList.todos.length > 0 && todoList.todos.every(todo => todo.done);
  }

  hasUndoneTodos(todoList) {
    return todoList.todos.some(todo => !todo.done);
  }

  // Returns a copy of the list of todo lists sorted by completion status and
  // title (case-insensitive).
  sortedTodoLists() {
    let todoLists = deepCopy(this._todoLists);
    let undone = todoLists.filter(todoList => !this.isDoneTodoList(todoList));
    let done = todoLists.filter(todoList => this.isDoneTodoList(todoList));
    return sortTodoLists(undone, done);
  }

  sortedTodos(todoList) {
    let todos = todoList.todos;

    let undone = todos.filter(todo => !todo.done);
    let done = todos.filter(todo => todo.done);
    return deepCopy(sortTodos(undone, done));
  }

  // Returns 'true' if error seems to indicate a UNIQUE constraint violation
  isUniqueConstraintViolation(_error) {
    return false;
  }
};
