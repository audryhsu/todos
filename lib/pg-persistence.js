const { dbQuery } = require('./db-query');

module.exports = class PgPersistence {

  // Creates a new todoList
  async createNewTodoList(todoListTitle) {
    const CREATE_LIST = "INSERT INTO todolists (title) VALUES ($1)"

    try {
      let result = await dbQuery(CREATE_LIST, todoListTitle)
      return result.rowCount > 0
    } catch (e) {
      if (this.isUniqueConstraintViolation(e)) return false;
      throw e;
    }
  }

  // Returns a promise that resolves to 'true' if todolist with specified title exists list of todolists, 'false if otherwise'
  async existsTodoListTitle(todoListTitle) {
    let TODOLIST_TITLE = "SELECT title FROM todolists WHERE title = $1"
    let result = await dbQuery(TODOLIST_TITLE, todoListTitle)

    return result.rowCount > 0;
  }
  // Returns a promise that resolves to true if todolist title was updated successfully, false otherwsie
  async setListTitle(todoListId, title) {
    let SET_TITLE = "UPDATE todolists SET title = $1 WHERE id = $2"
    let result = await dbQuery(SET_TITLE,title, todoListId)
    return result.rowCount > 0;
  }

  // returns a promise that resolves to true on success, false if the todo list doesn't exist
  async deleteTodoList(todoListId) {
    let DELETE_TODOLIST = "DELETE FROM todolists WHERE id = $1"
    let result = await dbQuery(DELETE_TODOLIST, todoListId)

    return result.rowCount === 1;
  }

  async createTodo(title, todoListId) {
    let CREATE_TODO = "INSERT INTO todos (title, todolist_id) VALUES ($1, $2)"

    let result = await dbQuery(CREATE_TODO, title, todoListId)

    return result.rowCount > 0;
  }

  async completeAllTodos(todoListId) {
    let SET_DONE = "UPDATE todos SET done = 't' WHERE todolist_id = $1"
    let result = await dbQuery(SET_DONE, todoListId)

    return result.rowCount > 0;
  }

  // Removes a todo from the todoList, takes in a numeric todo id
  async removeTodo(todoListId, todoId) {
    const DELETE_TODO = "DELETE FROM todos WHERE todolist_id = $1 AND id = $2"

    let result = await dbQuery(DELETE_TODO, todoListId, todoId)

    return result.rowCount > 0
  }
  // Toggles todo completion status; Returns boolean value if todo is found.
  async toggleDoneTodo(todoListId, todoId) {
    const TOGGLE_DONE = "UPDATE todos SET done = NOT done WHERE todolist_id = $1 and id = $2"

    let result = await dbQuery(TOGGLE_DONE, todoListId, todoId)
    return result.rowCount > 0;
  }

  async loadTodo(todoListId, todoId) {
    const FIND_TODO = "SELECT * FROM todos WHERE todolist_id = $1 AND id = $2"
    let result = await dbQuery(FIND_TODO, todoListId, todoId)

    return result.rows[0]
  }

  // Find a todo list with the indicated ID. Returns `undefined` if not found.
  // Note that `todoListId` must be numeric.
  async loadTodoList(todoListId) {
    let FIND_TODOLIST = "SELECT * FROM todolists WHERE id = $1"
    let FIND_TODOS = "SELECT * FROM todos WHERE todolist_id = $1"

    let todoListResult = dbQuery(FIND_TODOLIST, todoListId)
    let todosResult = dbQuery(FIND_TODOS, todoListId)
    let resultBoth = await Promise.all([todoListResult, todosResult]) // wait for all promises to resolve

    let todoList = resultBoth[0].rows[0];
    if (!todoList) return undefined;

    // todoList.todos = resultBoth[1].rows;
    todoList.todos = await this.sortedTodos(todoList).catch((e) => {
      new Error("error at 126")
    })

    return todoList;
  }


  // Returns a copy of the list of todo lists sorted by completion status and
  // title (case-insensitive).
  async sortedTodoLists() {
    let ALL_TODOLISTS = "SELECT * FROM todolists"
    let ALL_TODOS = "SELECT * FROM todos WHERE todolist_id = $1"
    let result = await dbQuery(ALL_TODOLISTS)
    let todoLists = result.rows

    for (let i = 0; i < todoLists.length; i++) {
      let todoList = todoLists[i]
      let todos = await dbQuery(ALL_TODOS, todoList.id.toString())
      todoList.todos = todos.rows
    }
    return this._partitionTodoLists(todoLists)
  }

  async sortedTodos(todoList) {
    let SORTED_TODOS = "SELECT * FROM todos WHERE todolist_id = $1 ORDER BY done ASC, title"

    let result = await dbQuery(SORTED_TODOS, todoList.id)
    let todos = result.rows

    return todos;
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

  _partitionTodoLists(todoLists) {
    let undone = [];
    let done = [];

    todoLists.forEach((todoList, _) => {
      if (this.isDoneTodoList(todoList)) {
        done.push(todoList)
      } else {
        undone.push(todoList)
      }
    });

    let result = undone.concat(done)
    return undone.concat(done)
  }

    // Returns 'true' if error seems to indicate a UNIQUE constraint violation
  isUniqueConstraintViolation(error) {
    return /duplicate key value violates unique constraint/.test(String(error))
  }
};
