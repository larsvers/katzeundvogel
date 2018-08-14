(function () {
  'use strict';

  var xhtml = "http://www.w3.org/1999/xhtml";

  var namespaces = {
    svg: "http://www.w3.org/2000/svg",
    xhtml: xhtml,
    xlink: "http://www.w3.org/1999/xlink",
    xml: "http://www.w3.org/XML/1998/namespace",
    xmlns: "http://www.w3.org/2000/xmlns/"
  };

  function namespace(name) {
    var prefix = name += "", i = prefix.indexOf(":");
    if (i >= 0 && (prefix = name.slice(0, i)) !== "xmlns") name = name.slice(i + 1);
    return namespaces.hasOwnProperty(prefix) ? {space: namespaces[prefix], local: name} : name;
  }

  function creatorInherit(name) {
    return function() {
      var document = this.ownerDocument,
          uri = this.namespaceURI;
      return uri === xhtml && document.documentElement.namespaceURI === xhtml
          ? document.createElement(name)
          : document.createElementNS(uri, name);
    };
  }

  function creatorFixed(fullname) {
    return function() {
      return this.ownerDocument.createElementNS(fullname.space, fullname.local);
    };
  }

  function creator(name) {
    var fullname = namespace(name);
    return (fullname.local
        ? creatorFixed
        : creatorInherit)(fullname);
  }

  function none() {}

  function selector(selector) {
    return selector == null ? none : function() {
      return this.querySelector(selector);
    };
  }

  function selection_select(select) {
    if (typeof select !== "function") select = selector(select);

    for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, subgroup = subgroups[j] = new Array(n), node, subnode, i = 0; i < n; ++i) {
        if ((node = group[i]) && (subnode = select.call(node, node.__data__, i, group))) {
          if ("__data__" in node) subnode.__data__ = node.__data__;
          subgroup[i] = subnode;
        }
      }
    }

    return new Selection(subgroups, this._parents);
  }

  function empty() {
    return [];
  }

  function selectorAll(selector) {
    return selector == null ? empty : function() {
      return this.querySelectorAll(selector);
    };
  }

  function selection_selectAll(select) {
    if (typeof select !== "function") select = selectorAll(select);

    for (var groups = this._groups, m = groups.length, subgroups = [], parents = [], j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) {
        if (node = group[i]) {
          subgroups.push(select.call(node, node.__data__, i, group));
          parents.push(node);
        }
      }
    }

    return new Selection(subgroups, parents);
  }

  var matcher = function(selector) {
    return function() {
      return this.matches(selector);
    };
  };

  if (typeof document !== "undefined") {
    var element = document.documentElement;
    if (!element.matches) {
      var vendorMatches = element.webkitMatchesSelector
          || element.msMatchesSelector
          || element.mozMatchesSelector
          || element.oMatchesSelector;
      matcher = function(selector) {
        return function() {
          return vendorMatches.call(this, selector);
        };
      };
    }
  }

  var matcher$1 = matcher;

  function selection_filter(match) {
    if (typeof match !== "function") match = matcher$1(match);

    for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, subgroup = subgroups[j] = [], node, i = 0; i < n; ++i) {
        if ((node = group[i]) && match.call(node, node.__data__, i, group)) {
          subgroup.push(node);
        }
      }
    }

    return new Selection(subgroups, this._parents);
  }

  function sparse(update) {
    return new Array(update.length);
  }

  function selection_enter() {
    return new Selection(this._enter || this._groups.map(sparse), this._parents);
  }

  function EnterNode(parent, datum) {
    this.ownerDocument = parent.ownerDocument;
    this.namespaceURI = parent.namespaceURI;
    this._next = null;
    this._parent = parent;
    this.__data__ = datum;
  }

  EnterNode.prototype = {
    constructor: EnterNode,
    appendChild: function(child) { return this._parent.insertBefore(child, this._next); },
    insertBefore: function(child, next) { return this._parent.insertBefore(child, next); },
    querySelector: function(selector) { return this._parent.querySelector(selector); },
    querySelectorAll: function(selector) { return this._parent.querySelectorAll(selector); }
  };

  function constant(x) {
    return function() {
      return x;
    };
  }

  var keyPrefix = "$"; // Protect against keys like “__proto__”.

  function bindIndex(parent, group, enter, update, exit, data) {
    var i = 0,
        node,
        groupLength = group.length,
        dataLength = data.length;

    // Put any non-null nodes that fit into update.
    // Put any null nodes into enter.
    // Put any remaining data into enter.
    for (; i < dataLength; ++i) {
      if (node = group[i]) {
        node.__data__ = data[i];
        update[i] = node;
      } else {
        enter[i] = new EnterNode(parent, data[i]);
      }
    }

    // Put any non-null nodes that don’t fit into exit.
    for (; i < groupLength; ++i) {
      if (node = group[i]) {
        exit[i] = node;
      }
    }
  }

  function bindKey(parent, group, enter, update, exit, data, key) {
    var i,
        node,
        nodeByKeyValue = {},
        groupLength = group.length,
        dataLength = data.length,
        keyValues = new Array(groupLength),
        keyValue;

    // Compute the key for each node.
    // If multiple nodes have the same key, the duplicates are added to exit.
    for (i = 0; i < groupLength; ++i) {
      if (node = group[i]) {
        keyValues[i] = keyValue = keyPrefix + key.call(node, node.__data__, i, group);
        if (keyValue in nodeByKeyValue) {
          exit[i] = node;
        } else {
          nodeByKeyValue[keyValue] = node;
        }
      }
    }

    // Compute the key for each datum.
    // If there a node associated with this key, join and add it to update.
    // If there is not (or the key is a duplicate), add it to enter.
    for (i = 0; i < dataLength; ++i) {
      keyValue = keyPrefix + key.call(parent, data[i], i, data);
      if (node = nodeByKeyValue[keyValue]) {
        update[i] = node;
        node.__data__ = data[i];
        nodeByKeyValue[keyValue] = null;
      } else {
        enter[i] = new EnterNode(parent, data[i]);
      }
    }

    // Add any remaining nodes that were not bound to data to exit.
    for (i = 0; i < groupLength; ++i) {
      if ((node = group[i]) && (nodeByKeyValue[keyValues[i]] === node)) {
        exit[i] = node;
      }
    }
  }

  function selection_data(value, key) {
    if (!value) {
      data = new Array(this.size()), j = -1;
      this.each(function(d) { data[++j] = d; });
      return data;
    }

    var bind = key ? bindKey : bindIndex,
        parents = this._parents,
        groups = this._groups;

    if (typeof value !== "function") value = constant(value);

    for (var m = groups.length, update = new Array(m), enter = new Array(m), exit = new Array(m), j = 0; j < m; ++j) {
      var parent = parents[j],
          group = groups[j],
          groupLength = group.length,
          data = value.call(parent, parent && parent.__data__, j, parents),
          dataLength = data.length,
          enterGroup = enter[j] = new Array(dataLength),
          updateGroup = update[j] = new Array(dataLength),
          exitGroup = exit[j] = new Array(groupLength);

      bind(parent, group, enterGroup, updateGroup, exitGroup, data, key);

      // Now connect the enter nodes to their following update node, such that
      // appendChild can insert the materialized enter node before this node,
      // rather than at the end of the parent node.
      for (var i0 = 0, i1 = 0, previous, next; i0 < dataLength; ++i0) {
        if (previous = enterGroup[i0]) {
          if (i0 >= i1) i1 = i0 + 1;
          while (!(next = updateGroup[i1]) && ++i1 < dataLength);
          previous._next = next || null;
        }
      }
    }

    update = new Selection(update, parents);
    update._enter = enter;
    update._exit = exit;
    return update;
  }

  function selection_exit() {
    return new Selection(this._exit || this._groups.map(sparse), this._parents);
  }

  function selection_merge(selection$$1) {

    for (var groups0 = this._groups, groups1 = selection$$1._groups, m0 = groups0.length, m1 = groups1.length, m = Math.min(m0, m1), merges = new Array(m0), j = 0; j < m; ++j) {
      for (var group0 = groups0[j], group1 = groups1[j], n = group0.length, merge = merges[j] = new Array(n), node, i = 0; i < n; ++i) {
        if (node = group0[i] || group1[i]) {
          merge[i] = node;
        }
      }
    }

    for (; j < m0; ++j) {
      merges[j] = groups0[j];
    }

    return new Selection(merges, this._parents);
  }

  function selection_order() {

    for (var groups = this._groups, j = -1, m = groups.length; ++j < m;) {
      for (var group = groups[j], i = group.length - 1, next = group[i], node; --i >= 0;) {
        if (node = group[i]) {
          if (next && next !== node.nextSibling) next.parentNode.insertBefore(node, next);
          next = node;
        }
      }
    }

    return this;
  }

  function selection_sort(compare) {
    if (!compare) compare = ascending;

    function compareNode(a, b) {
      return a && b ? compare(a.__data__, b.__data__) : !a - !b;
    }

    for (var groups = this._groups, m = groups.length, sortgroups = new Array(m), j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, sortgroup = sortgroups[j] = new Array(n), node, i = 0; i < n; ++i) {
        if (node = group[i]) {
          sortgroup[i] = node;
        }
      }
      sortgroup.sort(compareNode);
    }

    return new Selection(sortgroups, this._parents).order();
  }

  function ascending(a, b) {
    return a < b ? -1 : a > b ? 1 : a >= b ? 0 : NaN;
  }

  function selection_call() {
    var callback = arguments[0];
    arguments[0] = this;
    callback.apply(null, arguments);
    return this;
  }

  function selection_nodes() {
    var nodes = new Array(this.size()), i = -1;
    this.each(function() { nodes[++i] = this; });
    return nodes;
  }

  function selection_node() {

    for (var groups = this._groups, j = 0, m = groups.length; j < m; ++j) {
      for (var group = groups[j], i = 0, n = group.length; i < n; ++i) {
        var node = group[i];
        if (node) return node;
      }
    }

    return null;
  }

  function selection_size() {
    var size = 0;
    this.each(function() { ++size; });
    return size;
  }

  function selection_empty() {
    return !this.node();
  }

  function selection_each(callback) {

    for (var groups = this._groups, j = 0, m = groups.length; j < m; ++j) {
      for (var group = groups[j], i = 0, n = group.length, node; i < n; ++i) {
        if (node = group[i]) callback.call(node, node.__data__, i, group);
      }
    }

    return this;
  }

  function attrRemove(name) {
    return function() {
      this.removeAttribute(name);
    };
  }

  function attrRemoveNS(fullname) {
    return function() {
      this.removeAttributeNS(fullname.space, fullname.local);
    };
  }

  function attrConstant(name, value) {
    return function() {
      this.setAttribute(name, value);
    };
  }

  function attrConstantNS(fullname, value) {
    return function() {
      this.setAttributeNS(fullname.space, fullname.local, value);
    };
  }

  function attrFunction(name, value) {
    return function() {
      var v = value.apply(this, arguments);
      if (v == null) this.removeAttribute(name);
      else this.setAttribute(name, v);
    };
  }

  function attrFunctionNS(fullname, value) {
    return function() {
      var v = value.apply(this, arguments);
      if (v == null) this.removeAttributeNS(fullname.space, fullname.local);
      else this.setAttributeNS(fullname.space, fullname.local, v);
    };
  }

  function selection_attr(name, value) {
    var fullname = namespace(name);

    if (arguments.length < 2) {
      var node = this.node();
      return fullname.local
          ? node.getAttributeNS(fullname.space, fullname.local)
          : node.getAttribute(fullname);
    }

    return this.each((value == null
        ? (fullname.local ? attrRemoveNS : attrRemove) : (typeof value === "function"
        ? (fullname.local ? attrFunctionNS : attrFunction)
        : (fullname.local ? attrConstantNS : attrConstant)))(fullname, value));
  }

  function defaultView(node) {
    return (node.ownerDocument && node.ownerDocument.defaultView) // node is a Node
        || (node.document && node) // node is a Window
        || node.defaultView; // node is a Document
  }

  function styleRemove(name) {
    return function() {
      this.style.removeProperty(name);
    };
  }

  function styleConstant(name, value, priority) {
    return function() {
      this.style.setProperty(name, value, priority);
    };
  }

  function styleFunction(name, value, priority) {
    return function() {
      var v = value.apply(this, arguments);
      if (v == null) this.style.removeProperty(name);
      else this.style.setProperty(name, v, priority);
    };
  }

  function selection_style(name, value, priority) {
    return arguments.length > 1
        ? this.each((value == null
              ? styleRemove : typeof value === "function"
              ? styleFunction
              : styleConstant)(name, value, priority == null ? "" : priority))
        : styleValue(this.node(), name);
  }

  function styleValue(node, name) {
    return node.style.getPropertyValue(name)
        || defaultView(node).getComputedStyle(node, null).getPropertyValue(name);
  }

  function propertyRemove(name) {
    return function() {
      delete this[name];
    };
  }

  function propertyConstant(name, value) {
    return function() {
      this[name] = value;
    };
  }

  function propertyFunction(name, value) {
    return function() {
      var v = value.apply(this, arguments);
      if (v == null) delete this[name];
      else this[name] = v;
    };
  }

  function selection_property(name, value) {
    return arguments.length > 1
        ? this.each((value == null
            ? propertyRemove : typeof value === "function"
            ? propertyFunction
            : propertyConstant)(name, value))
        : this.node()[name];
  }

  function classArray(string) {
    return string.trim().split(/^|\s+/);
  }

  function classList(node) {
    return node.classList || new ClassList(node);
  }

  function ClassList(node) {
    this._node = node;
    this._names = classArray(node.getAttribute("class") || "");
  }

  ClassList.prototype = {
    add: function(name) {
      var i = this._names.indexOf(name);
      if (i < 0) {
        this._names.push(name);
        this._node.setAttribute("class", this._names.join(" "));
      }
    },
    remove: function(name) {
      var i = this._names.indexOf(name);
      if (i >= 0) {
        this._names.splice(i, 1);
        this._node.setAttribute("class", this._names.join(" "));
      }
    },
    contains: function(name) {
      return this._names.indexOf(name) >= 0;
    }
  };

  function classedAdd(node, names) {
    var list = classList(node), i = -1, n = names.length;
    while (++i < n) list.add(names[i]);
  }

  function classedRemove(node, names) {
    var list = classList(node), i = -1, n = names.length;
    while (++i < n) list.remove(names[i]);
  }

  function classedTrue(names) {
    return function() {
      classedAdd(this, names);
    };
  }

  function classedFalse(names) {
    return function() {
      classedRemove(this, names);
    };
  }

  function classedFunction(names, value) {
    return function() {
      (value.apply(this, arguments) ? classedAdd : classedRemove)(this, names);
    };
  }

  function selection_classed(name, value) {
    var names = classArray(name + "");

    if (arguments.length < 2) {
      var list = classList(this.node()), i = -1, n = names.length;
      while (++i < n) if (!list.contains(names[i])) return false;
      return true;
    }

    return this.each((typeof value === "function"
        ? classedFunction : value
        ? classedTrue
        : classedFalse)(names, value));
  }

  function textRemove() {
    this.textContent = "";
  }

  function textConstant(value) {
    return function() {
      this.textContent = value;
    };
  }

  function textFunction(value) {
    return function() {
      var v = value.apply(this, arguments);
      this.textContent = v == null ? "" : v;
    };
  }

  function selection_text(value) {
    return arguments.length
        ? this.each(value == null
            ? textRemove : (typeof value === "function"
            ? textFunction
            : textConstant)(value))
        : this.node().textContent;
  }

  function htmlRemove() {
    this.innerHTML = "";
  }

  function htmlConstant(value) {
    return function() {
      this.innerHTML = value;
    };
  }

  function htmlFunction(value) {
    return function() {
      var v = value.apply(this, arguments);
      this.innerHTML = v == null ? "" : v;
    };
  }

  function selection_html(value) {
    return arguments.length
        ? this.each(value == null
            ? htmlRemove : (typeof value === "function"
            ? htmlFunction
            : htmlConstant)(value))
        : this.node().innerHTML;
  }

  function raise() {
    if (this.nextSibling) this.parentNode.appendChild(this);
  }

  function selection_raise() {
    return this.each(raise);
  }

  function lower() {
    if (this.previousSibling) this.parentNode.insertBefore(this, this.parentNode.firstChild);
  }

  function selection_lower() {
    return this.each(lower);
  }

  function selection_append(name) {
    var create = typeof name === "function" ? name : creator(name);
    return this.select(function() {
      return this.appendChild(create.apply(this, arguments));
    });
  }

  function constantNull() {
    return null;
  }

  function selection_insert(name, before) {
    var create = typeof name === "function" ? name : creator(name),
        select = before == null ? constantNull : typeof before === "function" ? before : selector(before);
    return this.select(function() {
      return this.insertBefore(create.apply(this, arguments), select.apply(this, arguments) || null);
    });
  }

  function remove() {
    var parent = this.parentNode;
    if (parent) parent.removeChild(this);
  }

  function selection_remove() {
    return this.each(remove);
  }

  function selection_cloneShallow() {
    return this.parentNode.insertBefore(this.cloneNode(false), this.nextSibling);
  }

  function selection_cloneDeep() {
    return this.parentNode.insertBefore(this.cloneNode(true), this.nextSibling);
  }

  function selection_clone(deep) {
    return this.select(deep ? selection_cloneDeep : selection_cloneShallow);
  }

  function selection_datum(value) {
    return arguments.length
        ? this.property("__data__", value)
        : this.node().__data__;
  }

  var filterEvents = {};

  if (typeof document !== "undefined") {
    var element$1 = document.documentElement;
    if (!("onmouseenter" in element$1)) {
      filterEvents = {mouseenter: "mouseover", mouseleave: "mouseout"};
    }
  }

  function filterContextListener(listener, index, group) {
    listener = contextListener(listener, index, group);
    return function(event) {
      var related = event.relatedTarget;
      if (!related || (related !== this && !(related.compareDocumentPosition(this) & 8))) {
        listener.call(this, event);
      }
    };
  }

  function contextListener(listener, index, group) {
    return function(event1) {
      try {
        listener.call(this, this.__data__, index, group);
      } finally {
      }
    };
  }

  function parseTypenames(typenames) {
    return typenames.trim().split(/^|\s+/).map(function(t) {
      var name = "", i = t.indexOf(".");
      if (i >= 0) name = t.slice(i + 1), t = t.slice(0, i);
      return {type: t, name: name};
    });
  }

  function onRemove(typename) {
    return function() {
      var on = this.__on;
      if (!on) return;
      for (var j = 0, i = -1, m = on.length, o; j < m; ++j) {
        if (o = on[j], (!typename.type || o.type === typename.type) && o.name === typename.name) {
          this.removeEventListener(o.type, o.listener, o.capture);
        } else {
          on[++i] = o;
        }
      }
      if (++i) on.length = i;
      else delete this.__on;
    };
  }

  function onAdd(typename, value, capture) {
    var wrap = filterEvents.hasOwnProperty(typename.type) ? filterContextListener : contextListener;
    return function(d, i, group) {
      var on = this.__on, o, listener = wrap(value, i, group);
      if (on) for (var j = 0, m = on.length; j < m; ++j) {
        if ((o = on[j]).type === typename.type && o.name === typename.name) {
          this.removeEventListener(o.type, o.listener, o.capture);
          this.addEventListener(o.type, o.listener = listener, o.capture = capture);
          o.value = value;
          return;
        }
      }
      this.addEventListener(typename.type, listener, capture);
      o = {type: typename.type, name: typename.name, value: value, listener: listener, capture: capture};
      if (!on) this.__on = [o];
      else on.push(o);
    };
  }

  function selection_on(typename, value, capture) {
    var typenames = parseTypenames(typename + ""), i, n = typenames.length, t;

    if (arguments.length < 2) {
      var on = this.node().__on;
      if (on) for (var j = 0, m = on.length, o; j < m; ++j) {
        for (i = 0, o = on[j]; i < n; ++i) {
          if ((t = typenames[i]).type === o.type && t.name === o.name) {
            return o.value;
          }
        }
      }
      return;
    }

    on = value ? onAdd : onRemove;
    if (capture == null) capture = false;
    for (i = 0; i < n; ++i) this.each(on(typenames[i], value, capture));
    return this;
  }

  function dispatchEvent(node, type, params) {
    var window = defaultView(node),
        event = window.CustomEvent;

    if (typeof event === "function") {
      event = new event(type, params);
    } else {
      event = window.document.createEvent("Event");
      if (params) event.initEvent(type, params.bubbles, params.cancelable), event.detail = params.detail;
      else event.initEvent(type, false, false);
    }

    node.dispatchEvent(event);
  }

  function dispatchConstant(type, params) {
    return function() {
      return dispatchEvent(this, type, params);
    };
  }

  function dispatchFunction(type, params) {
    return function() {
      return dispatchEvent(this, type, params.apply(this, arguments));
    };
  }

  function selection_dispatch(type, params) {
    return this.each((typeof params === "function"
        ? dispatchFunction
        : dispatchConstant)(type, params));
  }

  var root = [null];

  function Selection(groups, parents) {
    this._groups = groups;
    this._parents = parents;
  }

  function selection() {
    return new Selection([[document.documentElement]], root);
  }

  Selection.prototype = selection.prototype = {
    constructor: Selection,
    select: selection_select,
    selectAll: selection_selectAll,
    filter: selection_filter,
    data: selection_data,
    enter: selection_enter,
    exit: selection_exit,
    merge: selection_merge,
    order: selection_order,
    sort: selection_sort,
    call: selection_call,
    nodes: selection_nodes,
    node: selection_node,
    size: selection_size,
    empty: selection_empty,
    each: selection_each,
    attr: selection_attr,
    style: selection_style,
    property: selection_property,
    classed: selection_classed,
    text: selection_text,
    html: selection_html,
    raise: selection_raise,
    lower: selection_lower,
    append: selection_append,
    insert: selection_insert,
    remove: selection_remove,
    clone: selection_clone,
    datum: selection_datum,
    on: selection_on,
    dispatch: selection_dispatch
  };

  function select(selector) {
    return typeof selector === "string"
        ? new Selection([[document.querySelector(selector)]], [document.documentElement])
        : new Selection([[selector]], root);
  }

  var noop = {value: function() {}};

  function dispatch() {
    for (var i = 0, n = arguments.length, _ = {}, t; i < n; ++i) {
      if (!(t = arguments[i] + "") || (t in _)) throw new Error("illegal type: " + t);
      _[t] = [];
    }
    return new Dispatch(_);
  }

  function Dispatch(_) {
    this._ = _;
  }

  function parseTypenames$1(typenames, types) {
    return typenames.trim().split(/^|\s+/).map(function(t) {
      var name = "", i = t.indexOf(".");
      if (i >= 0) name = t.slice(i + 1), t = t.slice(0, i);
      if (t && !types.hasOwnProperty(t)) throw new Error("unknown type: " + t);
      return {type: t, name: name};
    });
  }

  Dispatch.prototype = dispatch.prototype = {
    constructor: Dispatch,
    on: function(typename, callback) {
      var _ = this._,
          T = parseTypenames$1(typename + "", _),
          t,
          i = -1,
          n = T.length;

      // If no callback was specified, return the callback of the given type and name.
      if (arguments.length < 2) {
        while (++i < n) if ((t = (typename = T[i]).type) && (t = get(_[t], typename.name))) return t;
        return;
      }

      // If a type was specified, set the callback for the given type and name.
      // Otherwise, if a null callback was specified, remove callbacks of the given name.
      if (callback != null && typeof callback !== "function") throw new Error("invalid callback: " + callback);
      while (++i < n) {
        if (t = (typename = T[i]).type) _[t] = set(_[t], typename.name, callback);
        else if (callback == null) for (t in _) _[t] = set(_[t], typename.name, null);
      }

      return this;
    },
    copy: function() {
      var copy = {}, _ = this._;
      for (var t in _) copy[t] = _[t].slice();
      return new Dispatch(copy);
    },
    call: function(type, that) {
      if ((n = arguments.length - 2) > 0) for (var args = new Array(n), i = 0, n, t; i < n; ++i) args[i] = arguments[i + 2];
      if (!this._.hasOwnProperty(type)) throw new Error("unknown type: " + type);
      for (t = this._[type], i = 0, n = t.length; i < n; ++i) t[i].value.apply(that, args);
    },
    apply: function(type, that, args) {
      if (!this._.hasOwnProperty(type)) throw new Error("unknown type: " + type);
      for (var t = this._[type], i = 0, n = t.length; i < n; ++i) t[i].value.apply(that, args);
    }
  };

  function get(type, name) {
    for (var i = 0, n = type.length, c; i < n; ++i) {
      if ((c = type[i]).name === name) {
        return c.value;
      }
    }
  }

  function set(type, name, callback) {
    for (var i = 0, n = type.length; i < n; ++i) {
      if (type[i].name === name) {
        type[i] = noop, type = type.slice(0, i).concat(type.slice(i + 1));
        break;
      }
    }
    if (callback != null) type.push({name: name, value: callback});
    return type;
  }

  function ascending$1(a, b) {
    return a < b ? -1 : a > b ? 1 : a >= b ? 0 : NaN;
  }

  function bisector(compare) {
    if (compare.length === 1) compare = ascendingComparator(compare);
    return {
      left: function(a, x, lo, hi) {
        if (lo == null) lo = 0;
        if (hi == null) hi = a.length;
        while (lo < hi) {
          var mid = lo + hi >>> 1;
          if (compare(a[mid], x) < 0) lo = mid + 1;
          else hi = mid;
        }
        return lo;
      },
      right: function(a, x, lo, hi) {
        if (lo == null) lo = 0;
        if (hi == null) hi = a.length;
        while (lo < hi) {
          var mid = lo + hi >>> 1;
          if (compare(a[mid], x) > 0) hi = mid;
          else lo = mid + 1;
        }
        return lo;
      }
    };
  }

  function ascendingComparator(f) {
    return function(d, x) {
      return ascending$1(f(d), x);
    };
  }

  var ascendingBisect = bisector(ascending$1);

  function number(x) {
    return x === null ? NaN : +x;
  }

  function max(values, valueof) {
    var n = values.length,
        i = -1,
        value,
        max;

    if (valueof == null) {
      while (++i < n) { // Find the first comparable value.
        if ((value = values[i]) != null && value >= value) {
          max = value;
          while (++i < n) { // Compare the remaining values.
            if ((value = values[i]) != null && value > max) {
              max = value;
            }
          }
        }
      }
    }

    else {
      while (++i < n) { // Find the first comparable value.
        if ((value = valueof(values[i], i, values)) != null && value >= value) {
          max = value;
          while (++i < n) { // Compare the remaining values.
            if ((value = valueof(values[i], i, values)) != null && value > max) {
              max = value;
            }
          }
        }
      }
    }

    return max;
  }

  function mean(values, valueof) {
    var n = values.length,
        m = n,
        i = -1,
        value,
        sum = 0;

    if (valueof == null) {
      while (++i < n) {
        if (!isNaN(value = number(values[i]))) sum += value;
        else --m;
      }
    }

    else {
      while (++i < n) {
        if (!isNaN(value = number(valueof(values[i], i, values)))) sum += value;
        else --m;
      }
    }

    if (m) return sum / m;
  }

  var frame = 0, // is an animation frame pending?
      timeout = 0, // is a timeout pending?
      interval = 0, // are any timers active?
      pokeDelay = 1000, // how frequently we check for clock skew
      taskHead,
      taskTail,
      clockLast = 0,
      clockNow = 0,
      clockSkew = 0,
      clock = typeof performance === "object" && performance.now ? performance : Date,
      setFrame = typeof window === "object" && window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : function(f) { setTimeout(f, 17); };

  function now() {
    return clockNow || (setFrame(clearNow), clockNow = clock.now() + clockSkew);
  }

  function clearNow() {
    clockNow = 0;
  }

  function Timer() {
    this._call =
    this._time =
    this._next = null;
  }

  Timer.prototype = timer.prototype = {
    constructor: Timer,
    restart: function(callback, delay, time) {
      if (typeof callback !== "function") throw new TypeError("callback is not a function");
      time = (time == null ? now() : +time) + (delay == null ? 0 : +delay);
      if (!this._next && taskTail !== this) {
        if (taskTail) taskTail._next = this;
        else taskHead = this;
        taskTail = this;
      }
      this._call = callback;
      this._time = time;
      sleep();
    },
    stop: function() {
      if (this._call) {
        this._call = null;
        this._time = Infinity;
        sleep();
      }
    }
  };

  function timer(callback, delay, time) {
    var t = new Timer;
    t.restart(callback, delay, time);
    return t;
  }

  function timerFlush() {
    now(); // Get the current time, if not already set.
    ++frame; // Pretend we’ve set an alarm, if we haven’t already.
    var t = taskHead, e;
    while (t) {
      if ((e = clockNow - t._time) >= 0) t._call.call(null, e);
      t = t._next;
    }
    --frame;
  }

  function wake() {
    clockNow = (clockLast = clock.now()) + clockSkew;
    frame = timeout = 0;
    try {
      timerFlush();
    } finally {
      frame = 0;
      nap();
      clockNow = 0;
    }
  }

  function poke() {
    var now = clock.now(), delay = now - clockLast;
    if (delay > pokeDelay) clockSkew -= delay, clockLast = now;
  }

  function nap() {
    var t0, t1 = taskHead, t2, time = Infinity;
    while (t1) {
      if (t1._call) {
        if (time > t1._time) time = t1._time;
        t0 = t1, t1 = t1._next;
      } else {
        t2 = t1._next, t1._next = null;
        t1 = t0 ? t0._next = t2 : taskHead = t2;
      }
    }
    taskTail = t0;
    sleep(time);
  }

  function sleep(time) {
    if (frame) return; // Soonest alarm already set, or will be.
    if (timeout) timeout = clearTimeout(timeout);
    var delay = time - clockNow; // Strictly less than if we recomputed clockNow.
    if (delay > 24) {
      if (time < Infinity) timeout = setTimeout(wake, time - clock.now() - clockSkew);
      if (interval) interval = clearInterval(interval);
    } else {
      if (!interval) clockLast = clock.now(), interval = setInterval(poke, pokeDelay);
      frame = 1, setFrame(wake);
    }
  }

  function interval$1(callback, delay, time) {
    var t = new Timer, total = delay;
    if (delay == null) return t.restart(callback, delay, time), t;
    delay = +delay, time = time == null ? now() : +time;
    t.restart(function tick(elapsed) {
      elapsed += total;
      t.restart(tick, total += delay, time);
      callback(elapsed);
    }, delay, time);
    return t;
  }

  /**
   * Returns a function, that, as long as it continues to be invoked, will not
   * be triggered. The function will be called after it stops being called for
   * N milliseconds. If `immediate` is passed, trigger the function on the
   * leading edge, instead of the trailing. The function also has a property 'clear' 
   * that is a function which will clear the timer to prevent previously scheduled executions. 
   *
   * @source underscore.js
   * @see http://unscriptable.com/2009/03/20/debouncing-javascript-methods/
   * @param {Function} function to wrap
   * @param {Number} timeout in ms (`100`)
   * @param {Boolean} whether to execute at the beginning (`false`)
   * @api public
   */

  // Utility functions.
  function each(a, f) {
    for (var i = 0, l = a.length; i < l; i++) {
      f(a[i], i);
    }
  }
  function padd(p1, p2) {
    return { x: p1.x + p2.x, y: p1.y + p2.y, z: p1.z + p2.z };
  }
  function paddto(p1, p2) {
    p1.x += p2.x;
    p1.y += p2.y;
    p1.z += p2.z;
  }
  function psub(p1, p2) {
    return { x: p1.x - p2.x, y: p1.y - p2.y, z: p1.z - p2.z };
  }
  function psubfrom(p1, p2) {
    p1.x -= p2.x;
    p1.y -= p2.y;
    p1.z -= p2.z;
  }
  function pmul(p, c) {
    return { x: p.x * c, y: p.y * c, z: p.z * c };
  }
  function pmulby(p, c) {
    p.x *= c;
    p.y *= c;
    p.z *= c;
  }
  function metric(p1, p2) {
    var dx = p1.x - p2.x,
        dy = p1.y - p2.y,
        dz = p1.z - p2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  function magnitude(p) {
    return metric(p, { x: 0, y: 0, z: 0 });
  }
  function near(p1, p2, r) {
    return metric(p1, p2) <= r;
  }
  function yz(p) {
    return { x: 0, y: p.y, z: p.z };
  }

  // Draw helpers.
  function circle(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.fill();
  }
  function line(ctx, x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.closePath();
    ctx.stroke();
  }

  function beatDetect(audioElement, dispatcher) {
    // AudioContext, Analyser and Audio.
    var audioContext = new (window.AudioContext || window.webkitAudioContext)();
    // Get the Analyser node.
    var analyser = audioContext.createAnalyser();

    // Connect the nodes from source to destination.
    var source = audioContext.createMediaElementSource(audioElement);
    source.connect(analyser);
    analyser.connect(audioContext.destination);

    // Set up the audio data capture.
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.8;
    var bufferLength = analyser.frequencyBinCount;
    var dataArrayFreq = new Uint8Array(bufferLength);

    var queue = [];
    var event = {};
    var firstBeat = true;

    function declareEvent(data) {
      // Get max of the low frequencies.
      var maxAmplitude = Math.round(max(data.slice(1, 6)));

      // Implement 2-item queue.
      queue.push(maxAmplitude);
      if (queue.length > 2) {
        queue.shift();
      }

      // Establish beat event.
      if (queue[0] === 255 && queue[1] - queue[0] < 0) {
        // This is the core. Sort of works
        // debugger
        // console.log(`ding ${Math.random()}`);

        event = {
          message: "It's a beat it is",
          beat: true,
          firstBeat: firstBeat
        };

        firstBeat = false;

        dispatcher.call('beat', undefined, event);
      }
    }

    function loop() {
      requestAnimationFrame(loop);

      analyser.getByteFrequencyData(dataArrayFreq);

      declareEvent(dataArrayFreq);
    }

    loop();
  }

  /**
   * Drawing the cat's eyes
   * @param  {Object} context  Canvas' context to draw on.
   * @param  {Object} imgDims  Dimensions of thhe image to draw eys into.
   * @param  {Object} focus    Position of the thing to move the eyes to.
   * @return {undefined}       DOM side effects.
   */
  function drawEyes(context, imgDims, focus) {

    // Mapping the flock's x position to the eyes x position.
    var maxRange = imgDims.width * 0.19;
    var xMove = maxRange * focus.xPerc;

    // x position of eyes in pixel.
    var xLeftEye = imgDims.width * 0.30 + xMove;
    var xRightEye = imgDims.width * 0.69 + xMove;

    // y position of eyes in pixel.
    var yLeftEye = imgDims.y + imgDims.height * 0.66;
    var yRightEye = imgDims.y + imgDims.height * 0.64;

    // Draw.
    context.clearRect(0, 0, context.canvas.width, context.canvas.height);

    context.beginPath();
    context.arc(xLeftEye, yLeftEye, 2, 0, 2 * Math.PI);
    context.arc(xRightEye, yRightEye, 2, 0, 2 * Math.PI);
    context.fill();
  }

  function ready(w, h) {
    /* The sound */
    /* --------- */

    var audio = document.querySelector('#music');

    var dispatcher = dispatch('beat');

    beatDetect(audio, dispatcher);

    /* The birds */
    /* --------- */

    // Flock canvas and context.
    var canFlock = select('#flock').node();
    canFlock.width = w, canFlock.height = h;
    var ctxFlock = canFlock.getContext('2d');

    // Settings.
    // Keep unchanged.
    var FLOCK_SIZE = 100;
    var NUM_POWER_LINES = 3;
    var POWER_LINES_Z = 20.0;
    var POWER_LINES_Y = 5.0;
    var POWER_LINES_SPACING = 3.0;
    var WALL_COLLISION_DISTANCE = 4.0;
    var POWER_LINE_ATTRACTION_WEIGHT = 0.2;
    var POWER_LINE_ATTRACT_DISTANCE = 3.0;
    var POWER_LINE_SIT_DISTANCE = 0.4;
    var MINIMUM_SIT_VELOCITY = 0.5;
    var SITTING_INFLUENCE_DISTANCE = 3.5;
    var STEP_DISTANCE = 0.2;
    var STEP_TIMING = 10;
    var IDEAL_LINE_DISTANCE = 1.0;
    var TOLERABLE_LINE_DISTANCE = 0.5;
    var MINIMUM_LINE_DISTANCE = 0.4;
    var PYRAMID_BASE = 5.0;
    var PYRAMID_TOP = 50.0;
    var PYRAMID_HALFWIDTH_AT_BASE = PYRAMID_BASE;
    var PYRAMID_HALFWIDTH_AT_TOP = PYRAMID_TOP;
    var WALL_SLOPE = (PYRAMID_HALFWIDTH_AT_TOP - PYRAMID_HALFWIDTH_AT_BASE) / (PYRAMID_TOP - PYRAMID_BASE);
    var WIDTH_AT_BASE = PYRAMID_HALFWIDTH_AT_BASE - PYRAMID_BASE * WALL_SLOPE;
    var CENTER_ATTRACTION_WEIGHT = 0.01;
    var VELOCITY_ATTRACTION_WEIGHT = 0.125;
    var COLLISION_AVOIDANCE_WEIGHT = 0.2;
    var MESMARIZE_DISTANCE = 2.0;
    var LAUNCH_INFLUENCE = 3.0;
    var LAUNCH_VELOCITY = 1.0;

    // To be changed on beats.
    var COLLISION_DISTANCE = 1.0; // good
    var MAXIMUM_VELOCITY = 1; // good
    var flock = [];
    var lines = [];

    // Boids.
    function Boid(x, y, z) {
      var boid = {
        p: { x: x, y: y, z: z },
        powerLine: -1,
        v: { x: 0, y: 0, z: 0 }
      };
      var lastStep = 0;
      function stepSitting() {
        var i = void 0,
            b = void 0;
        var rightNeighbor = boid.p.z * WALL_SLOPE + WIDTH_AT_BASE,
            leftNeighbor = -rightNeighbor,
            difference = 0.0,
            flockInfluence = { x: 0, y: 0, z: 0 },
            influence = 0.0;

        for (i = 0; b = flock[i]; i++) {
          if (b === boid) continue;
          if (b.powerLine == boid.powerLine) {
            if (b.p.x < boid.p.x && b.p.x > leftNeighbor) leftNeighbor = b.p.x;
            if (b.p.x > boid.p.x && b.p.x < rightNeighbor) rightNeighbor = b.p.x;
          } else if (b.powerLine < 0 && near(boid.p, b.p, SITTING_INFLUENCE_DISTANCE)) {
            flockInfluence = padd(flockInfluence, b.v);
          }
        }
        leftNeighbor = boid.p.x - leftNeighbor;
        rightNeighbor -= boid.p.x;

        // if nearest neighbor is below minimum distance, launch
        if (leftNeighbor < MINIMUM_LINE_DISTANCE || rightNeighbor < MINIMUM_LINE_DISTANCE) {
          return launch();
        }

        // determine if the flock has influenced this boid to launch
        influence = magnitude(flockInfluence);
        if (influence > LAUNCH_INFLUENCE) return launch(pmul(flockInfluence, 1 / influence));

        if (++lastStep >= STEP_TIMING) {
          if (leftNeighbor < IDEAL_LINE_DISTANCE) {
            if (rightNeighbor < IDEAL_LINE_DISTANCE) {
              difference = rightNeighbor - leftNeighbor;
              if (difference < -STEP_DISTANCE) {
                boid.p.x -= STEP_DISTANCE;
                lastStep = 0;
              } else if (difference > STEP_DISTANCE) {
                boid.p.x += STEP_DISTANCE;
                lastStep = 0;
              } else if (rightNeighbor < TOLERABLE_LINE_DISTANCE || leftNeighbor < TOLERABLE_LINE_DISTANCE) {
                return launch();
              }
            } else if (leftNeighbor < IDEAL_LINE_DISTANCE - STEP_DISTANCE) {
              boid.p.x += STEP_DISTANCE;
              lastStep = 0;
            }
          } else if (rightNeighbor < IDEAL_LINE_DISTANCE - STEP_DISTANCE) {
            boid.p.x -= STEP_DISTANCE;
            lastStep = 0;
          }
        }
      }

      function stepFlying() {
        var centerOfFlock = { x: 0, y: 0, z: 0 };
        var averageVelocity = { x: 0, y: 0, z: 0 };
        var collisionAvoidance = { x: 0, y: 0, z: 0 };
        var powerLineAttraction = { x: 0, y: 0, z: 0 };
        var powerLineAdjustment = 1.0;
        var tmpPowerLineAdj = 1.0;
        var distance = 0.0;
        var vBar = 0.0;
        var widthAtZ = 0.0;
        var flying = 0;
        var mesmarized = false;

        // perform power line calculations
        for (var i = 0, _line; _line = lines[i]; i++) {
          distance = metric(yz(boid.p), _line);
          if (distance <= POWER_LINE_ATTRACT_DISTANCE) {
            vBar = _line.directionalVelocity(boid.p, boid.v);
            if (vBar >= 0) {
              powerLineAttraction.y += _line.y - boid.p.y;
              powerLineAttraction.z += _line.z - boid.p.z;
              tmpPowerLineAdj = distance / POWER_LINE_ATTRACT_DISTANCE;
              if (tmpPowerLineAdj < powerLineAdjustment) powerLineAdjustment = tmpPowerLineAdj;
              if (distance < POWER_LINE_SIT_DISTANCE && vBar < MINIMUM_SIT_VELOCITY) {
                // bird is now sitting, discontinue calculations
                boid.v.x = boid.v.y = boid.v.z = 0;
                boid.p.y = _line.y;
                boid.p.z = _line.z;
                boid.powerLine = i;
                return;
              }
              if (distance < MESMARIZE_DISTANCE) mesmarized = true;
            }
          }
        }

        // iterate through all boids calculating new velocity
        for (var _i = 0, b; b = flock[_i]; _i++) {
          if (b === boid || b.powerLine >= 0) continue;
          if (!mesmarized) {
            centerOfFlock = padd(centerOfFlock, b.p);
            averageVelocity = padd(averageVelocity, b.v);
          }

          if (near(b.p, boid.p, COLLISION_DISTANCE)) psubfrom(collisionAvoidance, psub(b.p, boid.p));

          flying++;
        }

        if (!mesmarized) centerOfFlock = psub(pmul(centerOfFlock, 1.0 / flying), boid.p);

        // perform collision avoidance on area boundries
        if (boid.p.z > PYRAMID_TOP - WALL_COLLISION_DISTANCE) collisionAvoidance.z += PYRAMID_TOP - WALL_COLLISION_DISTANCE - boid.p.z;
        if (boid.p.z < PYRAMID_BASE + WALL_COLLISION_DISTANCE) collisionAvoidance.z += PYRAMID_BASE + WALL_COLLISION_DISTANCE - boid.p.z;
        widthAtZ = boid.p.z * WALL_SLOPE + WIDTH_AT_BASE;
        if (boid.p.x > widthAtZ - WALL_COLLISION_DISTANCE) collisionAvoidance.x += widthAtZ - WALL_COLLISION_DISTANCE - boid.p.x;
        if (boid.p.x < -widthAtZ + WALL_COLLISION_DISTANCE) collisionAvoidance.x += -widthAtZ + WALL_COLLISION_DISTANCE - boid.p.x;
        if (boid.p.y > widthAtZ - WALL_COLLISION_DISTANCE) collisionAvoidance.y += widthAtZ - WALL_COLLISION_DISTANCE - boid.p.y;
        if (boid.p.y < -widthAtZ + WALL_COLLISION_DISTANCE) collisionAvoidance.y += -widthAtZ + WALL_COLLISION_DISTANCE - boid.p.y;

        // scale velocity modifiers
        if (!mesmarized) {
          pmulby(centerOfFlock, CENTER_ATTRACTION_WEIGHT);
          pmulby(averageVelocity, VELOCITY_ATTRACTION_WEIGHT / flying);
        }
        pmulby(collisionAvoidance, COLLISION_AVOIDANCE_WEIGHT);
        pmulby(powerLineAttraction, POWER_LINE_ATTRACTION_WEIGHT);

        // use calculations to compute new velocity
        paddto(boid.v, padd(padd(centerOfFlock, averageVelocity), padd(collisionAvoidance, powerLineAttraction)));
        vBar = magnitude(boid.v);
        if (powerLineAdjustment < 1.0 && vBar > 0.2) pmulby(boid.v, powerLineAdjustment);

        // do not let velocity exceed a maximum
        if (vBar > MAXIMUM_VELOCITY) pmulby(boid.v, MAXIMUM_VELOCITY / vBar);

        paddto(boid.p, boid.v);
      }

      function launch(direction) {
        if (!direction) {
          var theta = 2.0 * Math.PI * Math.random();
          direction = { x: 0, y: Math.sin(theta), z: Math.cos(theta) };
        }
        lastStep = 0;
        boid.powerLine = -1;
        boid.v.x = LAUNCH_VELOCITY * direction.x;
        boid.v.y = LAUNCH_VELOCITY * direction.y;
        boid.v.z = LAUNCH_VELOCITY * direction.z;
        return 0;
      }
      boid.step = function () {
        if (boid.powerLine >= 0) stepSitting();else stepFlying();
      };
      return boid;
    }

    // Power lines.
    function PowerLine(y, z) {
      var line$$1 = { x: 0, y: y, z: z };
      line$$1.directionalVelocity = function (p, v) {
        var distance = metric(yz(p), line$$1);
        return distance > 0.0 ? ((line$$1.y - p.y) * v.y + (line$$1.z - p.z) * v.z) / distance : -magnitude(yz(v));
      };
      return line$$1;
    }

    // Calculations.
    function step() {
      each(flock, function (b) {
        b.step();
      });
      draw();
    }

    function fog(ctx, z) {
      var c = Math.max(0, parseInt(-50 + 284 * (z / PYRAMID_TOP)));
      ctx.fillStyle = 'rgb(' + c + ',' + c + ',' + c + ')';
    }

    function getFlockCentre(currentFlock, canvasDims) {
      var flockCentre = currentFlock.map(function (b) {
        return {
          x: b.p.x * 225 / b.p.z + 300,
          y: b.p.y * 225 / b.p.z + 300
        };
      });

      var xCentre = mean(flockCentre, function (d) {
        return d.x;
      });
      var yCentre = mean(flockCentre, function (d) {
        return d.y;
      });
      var xCentrePerc = xCentre / canvasDims.width;
      var yCentrePerc = yCentre / canvasDims.height;

      return {
        x: xCentre,
        y: yCentre,
        xPerc: xCentrePerc,
        yPerc: yCentrePerc
      };
    }

    // Draw.
    function draw() {
      var ctx = ctxFlock;
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.fillStyle = '#000';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 0.5;

      flock.sort(function (a, b) {
        return b.p.z - a.p.z;
      });
      each(flock, function (b) {
        fog(ctx, b.p.z);
        circle(ctx, 225 * b.p.x / b.p.z + 300, 225 * b.p.y / b.p.z + 225, 62.5 / b.p.z);
      });
      each(lines, function (l) {
        var v = parseInt(225 * l.y / l.z + 225);
        line(ctx, 0, v, ctx.canvas.width, v);
      });
    }

    // Init.
    function initBirds() {
      // place all boids on side edge of world
      for (var i = 0; i < FLOCK_SIZE; i++) {
        var z = (PYRAMID_TOP - PYRAMID_BASE) * Math.random() + PYRAMID_BASE,
            _w = (z - PYRAMID_BASE) * (PYRAMID_HALFWIDTH_AT_TOP - PYRAMID_HALFWIDTH_AT_BASE) / (PYRAMID_TOP - PYRAMID_BASE) - PYRAMID_HALFWIDTH_AT_BASE,
            w2 = 2 * _w * Math.random() - _w;
        var xy = [{ x: w2, y: _w }, { x: w2, y: -_w }, { y: w2, x: _w }, { y: w2, x: -_w }][parseInt(Math.random() * 3.99999)];
        flock.push(Boid(xy.x, xy.y, z));
      }

      // create power lines
      for (var _i2 = 0; _i2 < NUM_POWER_LINES; _i2++) {
        lines.push(PowerLine(POWER_LINES_Y + _i2 * POWER_LINES_SPACING, POWER_LINES_Z));
      }var timerBirds = interval$1(step, 50);
    }

    initBirds();

    /* Move birds on beat */
    /* ------------------ */

    // Update flock movement
    function changeFlockMovement() {
      COLLISION_DISTANCE = COLLISION_DISTANCE === 1.0 ? 2.0 : 1.0;
      MAXIMUM_VELOCITY = MAXIMUM_VELOCITY === 1 ? 1.5 : 1;
    }

    // Flock movement changes on beat and on open beat gate.
    var beatGate = true;
    var beatTimer = interval$1(function () {
      return beatGate = true;
    }, 1000);

    // Beat handler.
    dispatcher.on('beat', function (e) {
      if (beatGate) changeFlockMovement();
      beatGate = false;
    });

    /* Draw the cat */
    /* ------------ */

    // The cat
    var canCat = select('#cat').node();
    canCat.width = w, canCat.height = h;
    var ctxCat = canCat.getContext('2d');

    var cat = document.getElementById('cat-image');
    var catDims = {
      x: 0,
      y: h - cat.height,
      width: cat.width,
      height: cat.height
    };
    ctxCat.drawImage(cat, catDims.x, catDims.y);
    var canDims = { width: canCat.width, height: canCat.height

      // The eyes
    };var canEyes = select('#eyes').node();
    canEyes.width = w, canEyes.height = h;
    var ctxEyes = canEyes.getContext('2d');

    // Calculate and draw.
    function moveEyes() {
      var flockPosition = getFlockCentre(flock, canDims);
      drawEyes(ctxEyes, catDims, flockPosition);
    }

    var timerEyes = interval$1(moveEyes, 50);
  }

  function resize() {
    var w = window.innerWidth;
    var h = window.innerHeight;

    ready(w, h);
  }

  // window.addEventListener('resize', debounce(resize, 150));
  resize();

}());
//# sourceMappingURL=bundle.js.map
