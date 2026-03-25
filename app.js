// remoteStorage module
const crud = {
  name: 'crud',
  builder (privateClient) {
    privateClient.declareType('crud-item', {
      type: 'object',
      properties: {
        name: { type: 'string' },
      },
      required: ['name'],
    });

    return {
      exports: {
        cacheItems: () => privateClient.cache(''),

        handle: privateClient.on,

        addItem: object => privateClient.storeObject('crud-item', new Date().toJSON().replace(/\D/g, ''), object),

        updateItem: (id, object) => privateClient.storeObject('crud-item', id, object),

        removeItem: privateClient.remove.bind(privateClient),

        getAllItems: () => privateClient.getAll('', false),
      },
    };
  },
};

// remoteStorage api
const api = new RemoteStorage({
  modules: [crud],
  logging: true,
  changeEvents: { local: true, window: true, remote: true, conflict: true },
});

api.access.claim('crud', 'rw');

api.crud.cacheItems();

// remoteStorage events
api.crud.handle('change', event => {
  if (event.newValue && !event.oldValue)
    return console.info(`Change from ${ event.origin } (add)`, event) || view.renderItem(event.relativePath, event.newValue);

  if (!event.newValue && event.oldValue)
    return console.info(`Change from ${ event.origin } (remove)`, event) || view.unrenderItem(event.relativePath);

  if (event.newValue && event.oldValue) {
    console.info(`Change from ${ event.origin } (change)`, event);

    if (event.origin !== 'conflict')
      return view.renderItems();

    return api.crud.updateItem(event.relativePath, Object.assign(event.newValue, {
      name: `${ event.oldValue.name } / ${ event.newValue.name } (was ${ event.lastCommonValue.name })`,
    })).then(view.renderItems);
  }

  console.info(`Change from ${ event.origin }`, event);
});

// interface
const view = {

  renderItems: () => api.crud.getAllItems().then(items => {
    document.querySelector('ul').innerHTML = '';

    items.forEach(e => view.renderItem(e, items[e]));
  }),

  _li: id => document.querySelector(`li[data-id="${ id }"]`),

  renderItem (id, object) {
    let li = view._li(id);

    if (!li) {
      li = document.createElement('li');
      li.dataset.id = id;
      document.querySelector('ul').appendChild(li);
    }

    li.innerHTML += `<form>
      <input type="text" value="${ object.name }" placeholder="name">
      <button class="save">Save</button>
      <a class="delete button" title="Delete" href="#">×</a>
    </form>`;
    
    const save = li.querySelector('button.save');
    const input = li.querySelector('input');

    input.addEventListener('focus', () => save.style.visibility = 'visible');
    
    input.addEventListener('blur', () => {
      setTimeout(() => save.style.visibility = 'hidden', 100)
    });

    input.addEventListener('keydown', event => {
      if (event.key !== 'Enter')
        return

      event.preventDefault();
      api.crud.updateItem(id, Object.assign(object, {
        name: input.value,
      }));
    });

    save.addEventListener('click', () => api.crud.updateItem(id, Object.assign(object, {
      name: input.value,
    })));

    li.querySelector('a.delete').addEventListener('click', event => {
      event.preventDefault();

      api.crud.removeItem(li.dataset.id);
    });
  },

  unrenderItem: id => document.querySelector('ul').removeChild(view._li(id)),

  emptyItems () {
    document.querySelector('ul').innerHTML = '';
    document.querySelector('#add-item input').value = '';
  },

};

// setup after page loads
document.addEventListener('DOMContentLoaded', () => {
  (new Widget(api)).attach(document.querySelector('widget-wrapper'));

  api.on('ready', () => {
    document.getElementById('add-item').addEventListener('submit', event => {
      event.preventDefault();

      const name = document.querySelector('#add-item input').value.trim();
      if (name)
        api.crud.addItem({ name })

      document.querySelector('#add-item input').value = '';
    });
  });

  api.on('disconnected', view.emptyItems);  
});
