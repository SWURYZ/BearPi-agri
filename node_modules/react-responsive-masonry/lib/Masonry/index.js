"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;

var _propTypes = _interopRequireDefault(require("prop-types"));

var _react = _interopRequireDefault(require("react"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _extends() { _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }

function _inheritsLoose(subClass, superClass) { subClass.prototype = Object.create(superClass.prototype); subClass.prototype.constructor = subClass; _setPrototypeOf(subClass, superClass); }

function _setPrototypeOf(o, p) { _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf(o, p); }

var Masonry = /*#__PURE__*/function (_React$Component) {
  _inheritsLoose(Masonry, _React$Component);

  function Masonry() {
    var _this;

    _this = _React$Component.call(this) || this;
    _this.state = {
      columns: [],
      childRefs: [],
      hasDistributed: false
    };
    return _this;
  }

  var _proto = Masonry.prototype;

  _proto.componentDidUpdate = function componentDidUpdate() {
    if (!this.state.hasDistributed && !this.props.sequential) this.distributeChildren();
  };

  Masonry.getDerivedStateFromProps = function getDerivedStateFromProps(props, state) {
    var children = props.children,
        columnsCount = props.columnsCount;
    var hasColumnsChanged = columnsCount !== state.columns.length;
    if (state && children === state.children && !hasColumnsChanged) return null;
    return _extends({}, Masonry.getEqualCountColumns(children, columnsCount), {
      children: children,
      hasDistributed: false
    });
  };

  _proto.shouldComponentUpdate = function shouldComponentUpdate(nextProps) {
    return nextProps.children !== this.state.children || nextProps.columnsCount !== this.props.columnsCount;
  };

  _proto.distributeChildren = function distributeChildren() {
    var _this2 = this;

    var _this$props = this.props,
        children = _this$props.children,
        columnsCount = _this$props.columnsCount;
    var columnHeights = Array(columnsCount).fill(0);
    var isReady = this.state.childRefs.every(function (ref) {
      return ref.current.getBoundingClientRect().height;
    });
    if (!isReady) return;
    var columns = Array.from({
      length: columnsCount
    }, function () {
      return [];
    });
    var validIndex = 0;

    _react["default"].Children.forEach(children, function (child) {
      if (child && _react["default"].isValidElement(child)) {
        // .current is undefined if ref was passed to a functional component without forwardRef
        // now passing ref into a wrapper div so it should always be defined
        var childHeight = _this2.state.childRefs[validIndex].current.getBoundingClientRect().height;

        var minHeightColumnIndex = columnHeights.indexOf(Math.min.apply(Math, columnHeights));
        columnHeights[minHeightColumnIndex] += childHeight;
        columns[minHeightColumnIndex].push(child);
        validIndex++;
      }
    });

    this.setState(function (p) {
      return _extends({}, p, {
        columns: columns,
        hasDistributed: true
      });
    });
  };

  Masonry.getEqualCountColumns = function getEqualCountColumns(children, columnsCount) {
    var columns = Array.from({
      length: columnsCount
    }, function () {
      return [];
    });
    var validIndex = 0;
    var childRefs = [];

    _react["default"].Children.forEach(children, function (child) {
      if (child && _react["default"].isValidElement(child)) {
        var ref = _react["default"].createRef();

        childRefs.push(ref);
        columns[validIndex % columnsCount].push( /*#__PURE__*/_react["default"].createElement("div", {
          style: {
            display: "flex",
            justifyContent: "stretch"
          },
          key: validIndex,
          ref: ref
        }, child) // React.cloneElement(child, {ref}) // cannot attach refs to functional components without forwardRef
        );
        validIndex++;
      }
    });

    return {
      columns: columns,
      childRefs: childRefs
    };
  };

  _proto.renderColumns = function renderColumns() {
    var _this$props2 = this.props,
        gutter = _this$props2.gutter,
        itemTag = _this$props2.itemTag,
        itemStyle = _this$props2.itemStyle;
    return this.state.columns.map(function (column, i) {
      return _react["default"].createElement(itemTag, {
        key: i,
        style: _extends({
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-start",
          alignContent: "stretch",
          flex: 1,
          width: 0,
          gap: gutter
        }, itemStyle)
      }, column.map(function (item) {
        return item;
      }));
    });
  };

  _proto.render = function render() {
    var _this$props3 = this.props,
        gutter = _this$props3.gutter,
        className = _this$props3.className,
        style = _this$props3.style,
        containerTag = _this$props3.containerTag;
    return _react["default"].createElement(containerTag, {
      style: _extends({
        display: "flex",
        flexDirection: "row",
        justifyContent: "center",
        alignContent: "stretch",
        boxSizing: "border-box",
        width: "100%",
        gap: gutter
      }, style),
      className: className
    }, this.renderColumns());
  };

  return Masonry;
}(_react["default"].Component);

Masonry.propTypes = process.env.NODE_ENV !== "production" ? {
  children: _propTypes["default"].oneOfType([_propTypes["default"].arrayOf(_propTypes["default"].node), _propTypes["default"].node]).isRequired,
  columnsCount: _propTypes["default"].number,
  gutter: _propTypes["default"].string,
  className: _propTypes["default"].string,
  style: _propTypes["default"].object,
  containerTag: _propTypes["default"].string,
  itemTag: _propTypes["default"].string,
  itemStyle: _propTypes["default"].object,
  sequential: _propTypes["default"].bool
} : {};
Masonry.defaultProps = {
  columnsCount: 3,
  gutter: "0",
  className: null,
  style: {},
  containerTag: "div",
  itemTag: "div",
  itemStyle: {},
  sequential: false
};
var _default = Masonry;
exports["default"] = _default;
module.exports = exports.default;