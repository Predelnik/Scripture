$(function () {

  var FileFunctionListModel = Backbone.Model.extend({
    initialize: function () {
      var dataModel = this.get('dataModel')
      this.listenTo(dataModel, 'change:data', this.extract)
      this.extract ()
    },

    genSignature: function (name, data) {
      return data.returns.type + ' ' + name + '('+_.map (data.args, function(argData)
      { 
        return argData.type + (argData.type.charAt (argData.type.length - 1) != '*' ? ' ' : '') + argData.name}).join (', ') + ')'
      },

    extract: function () {
      var dataModel = this.get('dataModel')
      var data = dataModel.get('data')
      var fileData = data.files
      var funcData = data.functions
      var fileName = this.get('fileName')
      var funcList = fileData[fileName]['functions']
      var data = _.map(funcList, function (functionName) { 
        var functionData = funcData[functionName]
        var signature = this.genSignature (functionName, functionData)
        return { name: functionName, data: functionData, signature: signature}; }, this)
      this.set('data', { data: data })
    },
  })

  var FunctionListView = Backbone.View.extend({
    template: _.template($('#function-list-template').html()),

    initialize: function () {
      this.listenTo(this.model, 'change:data', this.render)
    },

    render: function () {
      var data = this.model.get('data')
      
      this.$el.html (this.template (data))
      return this
    },
  })

  var FileListModel = Backbone.Model.extend({
    initialize: function () {
      var dataModel = this.get('dataModel')
      this.listenTo(dataModel, 'change:data', this.extract)
    },


    extract: function () {
      var data = this.get('dataModel').get ('data')
      var files = data['files']
      this.set('data', { files: files })
    },
  })

  var FileListView = Backbone.View.extend({
    el: $('#file-list'),
    events: {
      'click h3': 'toggleList',
    },

    toggleList: function(e) {
      $(e.currentTarget).next().toggle(100)
      return false
    },

    template: _.template($('#file-list-template').html()),

    initialize: function () {
      this.listenTo(this.model, 'change:data', this.render)
    },

    events: {
      'click h3': 'toggleList',
    },

    render: function () {
      var data = this.model.get('data')
      var menu = $(this.template({ files: data.files }))
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
    initialize: function(o) {
      this.dataModel = o.dataModel
      this.mainView = o.mainView
    },

    routes: {
      "": "index",
      "fileFunctions/:fileName": "fileFunctions"
      },
      index: function () {
      },

      fileFunctions: function (fileName) {
        var self = this
        var model = new FileFunctionListModel({ fileName: fileName, dataModel: self.dataModel })
        var view = new FunctionListView({ model: model })
        self.mainView.setActive(view)
      }
    }
  )

  var dataModel = new DataModel();
  var mainView = new MainView();
  var fileList = new FileListModel({ dataModel: dataModel });
  var fileListView = new FileListView({ model: fileList });
  var router = new Workspace({mainView : mainView, dataModel : dataModel})

  dataModel.once('change:data', function() {
    Backbone.history.start()})
})