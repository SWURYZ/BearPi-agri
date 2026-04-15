import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
var DEFAULT_COLUMNS_COUNT = 1;
var DEFAULT_GUTTER = "10px";
var useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

var useHasMounted = function useHasMounted() {
  var _useState = useState(false),
      hasMounted = _useState[0],
      setHasMounted = _useState[1];

  useIsomorphicLayoutEffect(function () {
    setHasMounted(true);
  }, []);
  return hasMounted;
};

var useWindowWidth = function useWindowWidth() {
  var hasMounted = useHasMounted();

  var _useState2 = useState(typeof window !== "undefined" ? window.innerWidth : 0),
      width = _useState2[0],
      setWidth = _useState2[1];

  var handleResize = useCallback(function () {
    if (!hasMounted) return;
    setWidth(window.innerWidth);
  }, [hasMounted]);
  useIsomorphicLayoutEffect(function () {
    if (hasMounted) {
      window.addEventListener("resize", handleResize);
      handleResize();
      return function () {
        return window.removeEventListener("resize", handleResize);
      };
    }
  }, [hasMounted, handleResize]);
  return width;
};

var MasonryResponsive = function MasonryResponsive(_ref) {
  var _ref$columnsCountBrea = _ref.columnsCountBreakPoints,
      columnsCountBreakPoints = _ref$columnsCountBrea === void 0 ? {
    350: 1,
    750: 2,
    900: 3
  } : _ref$columnsCountBrea,
      _ref$gutterBreakPoint = _ref.gutterBreakPoints,
      gutterBreakPoints = _ref$gutterBreakPoint === void 0 ? {} : _ref$gutterBreakPoint,
      children = _ref.children,
      _ref$className = _ref.className,
      className = _ref$className === void 0 ? null : _ref$className,
      _ref$style = _ref.style,
      style = _ref$style === void 0 ? null : _ref$style;
  var windowWidth = useWindowWidth();
  var getResponsiveValue = useCallback(function (breakPoints, defaultValue) {
    var sortedBreakPoints = Object.keys(breakPoints).sort(function (a, b) {
      return a - b;
    });
    var value = sortedBreakPoints.length > 0 ? breakPoints[sortedBreakPoints[0]] : defaultValue;
    sortedBreakPoints.forEach(function (breakPoint) {
      if (breakPoint < windowWidth) {
        value = breakPoints[breakPoint];
      }
    });
    return value;
  }, [windowWidth]);
  var columnsCount = useMemo(function () {
    return getResponsiveValue(columnsCountBreakPoints, DEFAULT_COLUMNS_COUNT);
  }, [getResponsiveValue, columnsCountBreakPoints]);
  var gutter = useMemo(function () {
    return getResponsiveValue(gutterBreakPoints, DEFAULT_GUTTER);
  }, [getResponsiveValue, gutterBreakPoints]);
  return /*#__PURE__*/React.createElement("div", {
    className: className,
    style: style
  }, React.Children.map(children, function (child, index) {
    return React.cloneElement(child, {
      key: index,
      columnsCount: columnsCount,
      gutter: gutter
    });
  }));
};

MasonryResponsive.propTypes = process.env.NODE_ENV !== "production" ? {
  children: PropTypes.oneOfType([PropTypes.arrayOf(PropTypes.node), PropTypes.node]).isRequired,
  columnsCountBreakPoints: PropTypes.object,
  className: PropTypes.string,
  style: PropTypes.object
} : {};
export default MasonryResponsive;