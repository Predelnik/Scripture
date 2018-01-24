$(function () {
var FileListModel = Backbone.Model.extend({
  initialize: function() {
    var dataModel = this.get('dataModel')
    this.listenTo(dataModel, 'change:files', this.extract)
  },


  extract: function() {
    var dataModel = this.get('dataModel')
    var files = dataModel.get('files')
    this.set('data', {files: files})
  },
})

var FileListView = Backbone.View.extend({
  el: $('#file-list'),

  template:  _.template($('#file-list-template').html()),

  initialize: function() {
    this.listenTo(this.model, 'change:data', this.render)
  },

  events: {
    'click h3': 'toggleList',
  },

  render: function() {
    var data = this.model.get('data')
    var menu = $(this.template({files: data.files}))
    this.$el.html(menu)
    return this
  },

  toggleList: function(e) {
    $(e.currentTarget).next().toggle(100)
    return false
  },
})

var DataModel = Backbone.Model.extend({
  initialize: function() {
    this.load()
  },
  load: function() {   
    $.getJSON('../data/functions.json').then(function(data) {
      dataModel.set({functions: data})
    })
    $.getJSON ('../data/files.json').then ((function(data) {
      dataModel.set({files: data})
    }))
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

  var dataModel = new DataModel();
  var mainView = new MainView();
  var fileList = new FileListModel({dataModel: dataModel});
  var fileListView = new FileListView({model: fileList});
})