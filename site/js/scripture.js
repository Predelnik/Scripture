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
    return data.returns.type + ' ' + functionName + '(' + _.map(data.args, function (argData) {
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
    },

    routes: {
      "": "index",
      "fileData/:fileName": "fileData",
      "struct/:structName": "struct",
      "enum/:enumName": "enum",
      "function/:functionName": "function",
      "variable/:variable": "variable",
    },
    index: function () {
    },

    fileData: function (fileName) {
      var self = this
      var model = new FileDataList({ fileName: fileName, dataModel: self.dataModel })
      var view = new FileDataView({ model: model })
      self.mainView.setActive(view)
    },

    struct: function (structName) {
      var self = this
      var model = new structModel({ dataModel: self.dataModel, structName : structName })
      var view = new structView ({ model: model })
      self.mainView.setActive(view)
    },

    function: function (functionName) {
      var self = this
      var model = new functionModel({ dataModel: self.dataModel, name : functionName })
      var view = new functionView ({ model: model })
      self.mainView.setActive(view)
    },

    enum: function (enumName) {
      var self = this
      var model = new enumModel({ dataModel: self.dataModel, enumName : enumName })
      var view = new enumView ({ model: model })
      self.mainView.setActive(view)
    },

    variable: function (varName) {
      var self = this
      var model = new varModel({ dataModel: self.dataModel, name : varName })
      var view = new varView ({ model: model })
      self.mainView.setActive(view)
    }
  }
  )

  var dataModel = new DataModel();
  var mainView = new MainView();
  var fileList = new MainMenuModel({ dataModel: dataModel });
  var fileListView = new MainMenuView({ model: fileList });
  var router = new Workspace({ mainView: mainView, dataModel: dataModel })

  dataModel.once('change:data', function () {
    Backbone.history.start()
  })
})