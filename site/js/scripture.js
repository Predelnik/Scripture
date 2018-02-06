$(function () {

  var typeNameToHtml = function (typeName, structs, enums) {
      lastChar = typeName.charAt(typeName.length - 1)
      var re = /([^\s\[\]*]+)(\s*(?:\[\d+\]|\*))?/g
      var match = re.exec (typeName)
      var name = match[1], suffix = match[2] ? match[2] : ''
      mbSpace = suffix ? '' : ' '
      if (name in structs)
        return '<a href=#struct/' + name + '>' + name + '</a>' + suffix + mbSpace
      else if (name in enums)
        return '<a href=#enum/' + name + '>' + name + '</a>' + suffix + mbSpace
      
      return typeName + mbSpace
  }

  var genSignature = function (functionName, data, structs, enums, includeLink) {
    if (includeLink)
      functionName = '<a href=#function/' + functionName + '>' + functionName + '</a>'
    return typeNameToHtml (data.returns.type, structs, enums) + ' ' + functionName + '&nbsp(' + _.map(data.args, function (argData) {
      argType = argData.type
      return typeNameToHtml (argType, structs, enums) + argData.name
    }).join(', ') + ')'
  }

  var structModel = Backbone.Model.extend({
    initialize: function () {
      var dataModel = this.get('dataModel')
      this.listenTo(dataModel, 'change:data', this.extract)
      this.extract()
    },

    extract: function () {
      var dataModel = this.get('dataModel')
      var data = dataModel.get('data')
      var structName = this.get('structName')
      var structData = data.structs[structName]
      _.each (structData.members, function (member){
        member.typeHtml = typeNameToHtml (member.type, data.structs, data.enums)
      })
      this.set('data', { structName: structName, structData: structData})
    },
  })

  var structView = Backbone.View.extend({
    template: _.template($('#struct-template').html()),

    initialize: function () {
      this.listenTo(this.model, 'change:data', this.render)
    },

    render: function () {
      var data = this.model.get('data')
      this.$el.html(this.template(data))
      return this
    },
  })

  var enumModel = Backbone.Model.extend({
    initialize: function () {
      var dataModel = this.get('dataModel')
      this.listenTo(dataModel, 'change:data', this.extract)
      this.extract()
    },

    extract: function () {
      var dataModel = this.get('dataModel')
      var data = dataModel.get('data')
      var enumName = this.get('enumName')
      var enumData = data.enums[enumName]
      this.set('data', { enumName: enumName, enumData: enumData})
    },
  })

  var enumView = Backbone.View.extend({
    template: _.template($('#enum-template').html()),

    initialize: function () {
      this.listenTo(this.model, 'change:data', this.render)
    },

    render: function () {
      var data = this.model.get('data')
      this.$el.html(this.template(data))
      return this
    },
  })

  var SearchFieldView = Backbone.View.extend({
    tagName: 'input',

    el: $('#search-field'),

    events: {
      'keyup': function() {
	this.trigger('keyup')
	if (this.$el.val() == '')
	  this.trigger('empty')
      }
    },
  })

  var SearchCollection = Backbone.Collection.extend({
    defaults: {
      value: '',
    },

    initialize: function(args) {
      this.field = args.field
      this.dataModel = args.dataModel

      this.listenTo(this.field, 'keyup', this.keyup)
    },

    keyup: function() {
      var newValue = this.field.$el.val()
      if (this.value == newValue || newValue.length < 3)
	return

      this.value = newValue
      this.refreshSearch()
    },

    refreshSearch: function() {
      var model = this.dataModel
      var value = this.value

      var data = model.get('data')
      var searchResults = []

      // look for functions (name, comment, argline)
      _.forEach(data.functions, function(functionData, name) {
        if (name.search(value) > -1) {
        var link = 'function/' + name
        searchResults.push({url: '#' + link, name: name, match: 'function', navigate: link})
          return
        }
        // TODO: support search for address
        // TODO: support search in arglines
      })

      // TODO: suuport search for structs/ members
      // TODO: suuport search for enums / members
      // TODO: support search for variables

      this.reset(searchResults)
    },
  })

  var SearchView = Backbone.View.extend({
    template: _.template($('#search-template').html()),

    // initialize: function() {
    //   this.listenTo(this.model, 'reset', this.render)
    // },

    render: function() {
      var content = this.template({results: this.collection.toJSON()})
      this.el = content
     }
  })

  var functionModel = Backbone.Model.extend({
    initialize: function () {
      var dataModel = this.get('dataModel')
      this.listenTo(dataModel, 'change:data', this.extract)
      this.extract()
    },

    extract: function () {
      var dataModel = this.get('dataModel')
      var data = dataModel.get('data')
      var name = this.get('name')
      var functionData = data.functions[name]
      this.set('data', { name: name, data: functionData, signature: genSignature (name, functionData, data.structs, data.enums, false)})
    },
  })

  var functionView = Backbone.View.extend({
    template: _.template($('#function-template').html()),

    initialize: function () {
      this.listenTo(this.model, 'change:data', this.render)
    },

    render: function () {
      var data = this.model.get('data')
      this.$el.html(this.template(data))
      return this
    },
  })

  var varModel = Backbone.Model.extend({
    initialize: function () {
      var dataModel = this.get('dataModel')
      this.listenTo(dataModel, 'change:data', this.extract)
      this.extract()
    },

    extract: function () {
      var dataModel = this.get('dataModel')
      var data = dataModel.get('data')
      var name = this.get('name')
      var varData = data.vars[name]
      this.set('data', { name: name, data: varData, typeHtml: typeNameToHtml (varData.type, data.structs, data.enums)})
    },
  })

  var varView = Backbone.View.extend({
    template: _.template($('#variable-template').html()),

    initialize: function () {
      this.listenTo(this.model, 'change:data', this.render)
    },

    render: function () {
      var data = this.model.get('data')
      this.$el.html(this.template(data))
      return this
    },
  })

  var FileDataList = Backbone.Model.extend({
    initialize: function () {
      var dataModel = this.get('dataModel')
      this.listenTo(dataModel, 'change:data', this.extract)
      this.extract()
    },

    extract: function () {
      var dataModel = this.get('dataModel')
      var data = dataModel.get('data')
      var fileName = this.get('fileName')
      var fileData = data.files[fileName]
      var functions = _.map(fileData.functions, function (functionName) {
      var functionData = data.functions[functionName]
      var signature = genSignature(functionName, functionData, data.structs, data.enums, true)
        return { name: functionName, data: functionData, signature: signature };
      }, this)
      var vars = _.map(fileData.vars, function (varName) {
        var varData = data.vars[varName]
          return { name: varName, data: varData, typeHtml : typeNameToHtml (varData.type, data.structs, data.enums) };
        }, this)
      
      this.set('data', { functions: functions, vars: vars })
    },
  })

  var FileDataView = Backbone.View.extend({
    template: _.template($('#file-data-list-template').html()),

    initialize: function () {
      this.listenTo(this.model, 'change:data', this.render)
    },

    render: function () {
      var data = this.model.get('data')

      this.$el.html(this.template(data))
      return this
    },
  })

  var MainMenuModel = Backbone.Model.extend({
    initialize: function () {
      var dataModel = this.get('dataModel')
      this.listenTo(dataModel, 'change:data', this.extract)
    },


    extract: function () {
      var data = this.get('dataModel').get('data')
      this.set('data', data)
    },
  })

  var MainMenuView = Backbone.View.extend({
    el: $('#main-menu'),
    events: {
      'click h3': 'toggleList',
    },

    toggleList: function (e) {
      $(e.currentTarget).next().toggle(100)
      return false
    },

    template: _.template($('#main-menu-template').html()),

    initialize: function () {
      this.listenTo(this.model, 'change:data', this.render)
    },

    events: {
      'click h3': 'toggleList',
    },

    render: function () {
      var data = this.model.get('data')
      var menu = $(this.template(data))
      this.$el.html(menu)
      return this
    },

    toggleList: function (e) {
      $(e.currentTarget).next().toggle(100)
      return false
    },
  })

  var DataModel = Backbone.Model.extend({
    initialize: function () {
      this.load()
    },
    load: function () {
      $.getJSON('../data/data.json').then(function (data) {
        dataModel.set({ data: data })
      })
    },
  })

  var MainView = Backbone.View.extend({
    el: $('#content'),

    setActive: function (view) {
      view.render()

      if (this.activeView) {
        this.stopListening()
        this.activeView.remove()
      }

      this.activeView = view
      // make sure we know when the view wants to render again
      this.listenTo(view, 'redraw', this.render)

      this.$el.html(view.el)

      // move back to the top when we switch views
      document.body.scrollTop = document.documentElement.scrollTop = 0;
    },

    render: function () {
      this.$el.html(this.activeView.el)
    },
  })

  var Workspace = Backbone.Router.extend({
    initialize: function (o) {
      this.dataModel = o.dataModel
      this.mainView = o.mainView
      this.search = o.search
    },

    routes: {
      "": "index",
      "fileData/:fileName": "fileData",
      "struct/:structName": "struct",
      "enum/:enumName": "enum",
      "function/:functionName": "function",
      "variable/:variable": "variable",
      "search/:query": "search",
    },
    index: function () {
    },

    fileData: function (fileName) {
      var model = new FileDataList({ fileName: fileName, dataModel: this.dataModel })
      var view = new FileDataView({ model: model })
      this.mainView.setActive(view)
    },

    struct: function (structName) {
      var model = new structModel({ dataModel: this.dataModel, structName : structName })
      var view = new structView ({ model: model })
      this.mainView.setActive(view)
    },

    function: function (functionName) {
      var model = new functionModel({ dataModel: this.dataModel, name : functionName })
      var view = new functionView ({ model: model })
      this.mainView.setActive(view)
    },

    enum: function (enumName) {
      var model = new enumModel({ dataModel: this.dataModel, enumName : enumName })
      var view = new enumView ({ model: model })
      this.mainView.setActive(view)
    },

    variable: function (varName) {
      var model = new varModel({ dataModel: this.dataModel, name : varName })
      var view = new varView ({ model: model })
      this.mainView.setActive(view)
    },

    search: function(query) {
      var view = new SearchView({collection: this.search})
      $('#search-field').val(query).keyup()
      this.mainView.setActive(view)
    },
  }
  )

  var dataModel = new DataModel();
  var mainView = new MainView();

  var searchField = new SearchFieldView({id: 'search-field'})
  var searchCol = new SearchCollection({dataModel: dataModel, field: searchField})

  var fileList = new MainMenuModel({ dataModel: dataModel });
  var fileListView = new MainMenuView({ model: fileList });
  var router = new Workspace({ mainView: mainView, dataModel: dataModel, search: searchCol })

  dataModel.once('change:data', function () {
    Backbone.history.start()
  })

  searchCol.on('reset', function(col, prev) {
    if (col.length == 1) {
      router.navigate(col.pluck('navigate')[0], {trigger: true, replace: true})
    } else {
      // FIXME: this keeps recreating the view
      router.navigate('search/' + col.value, {trigger: true})
    }
  })
})