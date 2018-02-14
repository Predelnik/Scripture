$(function () {

  var typeNameToHtml = function (typeName, structs, enums, varName = '') {
      lastChar = typeName.charAt(typeName.length - 1)
      var funcPtrPatten = /([a-zA-z]*)\s*\(\*\)\((?:([a-zA-z\*]*),\s*)*([a-zA-z\*]*)?\)/g
      var match = funcPtrPatten.exec (typeName)
      if (match) {
        firstUndef = _.findIndex (match, function (data){ return !data })
        if (varName)
          return match[1] + ' (*' + varName + ') (' + match.slice (2, firstUndef).join (', ') + ')'
        else
          return match[1] + ' (*) (' + match.slice (2, firstUndef).join (', ') + ')'
      }

      var usualPattern = /(const\s*)?([^\[\]\*\s]+)(?:\s*)(\**)(\[\d+\]*)?/g
      var match = usualPattern.exec (typeName)
      var prefix = match[1] ? match[1] : ''
      var name = match[2]
      var stars = match[3] ? match[3] : ''
      var extents = match[4] ? match[4] : ''
      stars = '&nbsp&nbsp' + stars
      htmlPrefix = ''
      if (name in structs)
        htmlPrefix = '<a href=#struct/'
      else if (name in enums)
        htmlPrefix = '<a href=#enum/'

      if (htmlPrefix)
        if (varName)
          return prefix + htmlPrefix + name + '>' + name + '</a>' + stars + varName + extents
        else
          return prefix + htmlPrefix + name + '>' + name + '</a>' + stars + extents

      if (varName)
        return prefix + name + stars + varName + extents
      return prefix + name + stars + extents
  }

  var htmlizeLinksInComment = function (text) {
    if (!text)
      return text
    var re = /((http)s?:\/+(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9\(\)@:%_\+.~#?&//=]*))/g
    text = text.replace (re, "<a href=$1>$1</a>")
    return text
  }

  var genFunctionSignature = function (functionName, data, structs, enums, includeLink) {
    if (includeLink)
      functionName = '<a href=#function/' + functionName + '>' + functionName + '</a>'
    return typeNameToHtml (data.returns.type, structs, enums) + functionName + '&nbsp(' + _.map(data.args, function (argData) {
      argType = argData.type
      return typeNameToHtml (argType, structs, enums) + argData.name
    }).join(', ') + ')'
  }

  var genGithubLink = function (data, info) {
    if (!data.github_root)
      return null

    sha1 = data.github_sha1 ? data.github_sha1 : 'master'
    link = '<a href="' + data.github_root + sha1 + '/' + info.full_file_name + '#L' + info.line + '">' + info.full_file_name + '</a>'
    return link
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
      structData.explanation = htmlizeLinksInComment (structData.explanation)
      _.each (structData.members, function (member){
        member.typeHtml = typeNameToHtml (member.type, data.structs, data.enums)
      })
      this.set('data', { structName: structName, structData: structData, github_link:genGithubLink (data, structData)})
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
      enumData.explanation = htmlizeLinksInComment (enumData.explanation)
      this.set('data', { enumName: enumName, enumData: enumData, github_link:genGithubLink (data, enumData)})
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
      timeoutHandle = null
    },

    keyup: function() {
      var newValue = this.field.$el.val()
      if (this.value == newValue || newValue.length < 3)
	return

      this.value = newValue
      self = this
      self.refreshSearch()
      /*
      if (timeoutHandle)
        clearTimeout (timeoutHandle)
      timeoutHandle = setTimeout( function () { self.refreshSearch()}, 500)
      */
    },

    refreshSearch: function() {
      var model = this.dataModel

      var data = model.get('data')
      var searchResults = []

      var containsStr = function (haystack, needle) {
        if (!haystack)
          return false;
        return haystack.toLowerCase().indexOf (needle.toLowerCase()) != -1
      }

      var needle = this.value

      _.forEach(data.functions, function(functionData, name) {
        if (containsStr (name, needle) || containsStr (functionData.address, needle) ||
           _.findIndex (functionData.args, function (argData){
            return containsStr (argData.name, needle);
           }) > -1) {
        var link = 'function/' + name
        searchResults.push({url: '#' + link, name: (functionData.address ? (functionData.address + ': ') : '') + name, match: 'function', navigate: link})
          return
        }
      })

      _.forEach(data.vars, function(variableData, name) {
        if (containsStr (name, needle) || containsStr (variableData.address, needle)) {
        var link = 'variable/' + name
        searchResults.push({url: '#' + link, name: (variableData.address ? (variableData.address + ': ') : '') + name, match: 'variable', navigate: link})
          return
        }
      })

      _.forEach(data.structs, function(structData, name) {
        if (containsStr (name, needle) ||
           _.findIndex (structData.members, function (member){
            return containsStr (member.name, needle);
           }) > -1) {
        var link = 'struct/' + name
        searchResults.push({url: '#' + link, name: name, match: 'struct', navigate: link})
          return
        }
      })

      _.forEach(data.enums, function(enumData, name) {
        if (containsStr (name, needle) ||
           _.findIndex (enumData.members, function (member){
            return containsStr (member.name, needle);
           }) > -1) {
        var link = 'enum/' + name
        searchResults.push({url: '#' + link, name: name, match: 'enum', navigate: link})
          return
        }
      })
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
      functionData.explanation = htmlizeLinksInComment (functionData.explanation)
      this.set('data', { name: name, data: functionData, signature: genFunctionSignature (name, functionData, data.structs, data.enums, false),
      github_link:genGithubLink (data, functionData)})
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
      varData.explanation = htmlizeLinksInComment (varData.explanation)
      this.set('data', { name: name, data: varData, typeHtml: typeNameToHtml (varData.type, data.structs, data.enums), github_link:genGithubLink (data, varData)})
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

  var FileDataModel = Backbone.Model.extend({
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
      var signature = genFunctionSignature(functionName, functionData, data.structs, data.enums, true)
        return { name: functionName, data: functionData, signature: signature };
      }, this)
      var vars = _.map(fileData.vars, function (varName) {
        var varData = data.vars[varName]
        nameLink = '<a href=#variable/' + varName + '>' + varName + '</a>'
          return { name: varName, data: varData, varSignatureHtml : typeNameToHtml (varData.type, data.structs, data.enums, nameLink) };
        }, this)

      this.set('data', { functions: functions, vars: vars, fileName: fileName })
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
      $.getJSON('data/data.json').then(function (data) {
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
      var model = new FileDataModel({ fileName: fileName, dataModel: this.dataModel })
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

  $(document).on('mouseenter', 'table.enumTable td', function(){
    var $this = $(this);

    if(this.offsetWidth < this.scrollWidth && !$this.attr('title')){
        $this.attr('title', $this.text());
    }
});

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