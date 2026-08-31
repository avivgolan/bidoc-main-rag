//#region \0rolldown/runtime.js
var e = Object.create, t = Object.defineProperty, n = Object.getOwnPropertyDescriptor, r = Object.getOwnPropertyNames, i = Object.getPrototypeOf, a = Object.prototype.hasOwnProperty, o = (e, t) => () => (t || (e((t = { exports: {} }).exports, t), e = null), t.exports), s = (e, i, o, s) => {
	if (i && typeof i == "object" || typeof i == "function") for (var c = r(i), l = 0, u = c.length, d; l < u; l++) d = c[l], !a.call(e, d) && d !== o && t(e, d, {
		get: ((e) => i[e]).bind(null, d),
		enumerable: !(s = n(i, d)) || s.enumerable
	});
	return e;
}, c = (n, r, a) => (a = n == null ? {} : e(i(n)), s(r || !n || !n.__esModule ? t(a, "default", {
	value: n,
	enumerable: !0
}) : a, n)), l = /* @__PURE__ */ o(((e) => {
	var t = Symbol.for("react.transitional.element"), n = Symbol.for("react.portal"), r = Symbol.for("react.fragment"), i = Symbol.for("react.strict_mode"), a = Symbol.for("react.profiler"), o = Symbol.for("react.consumer"), s = Symbol.for("react.context"), c = Symbol.for("react.forward_ref"), l = Symbol.for("react.suspense"), u = Symbol.for("react.memo"), d = Symbol.for("react.lazy"), f = Symbol.for("react.activity"), p = Symbol.iterator;
	function m(e) {
		return typeof e != "object" || !e ? null : (e = p && e[p] || e["@@iterator"], typeof e == "function" ? e : null);
	}
	var h = {
		isMounted: function() {
			return !1;
		},
		enqueueForceUpdate: function() {},
		enqueueReplaceState: function() {},
		enqueueSetState: function() {}
	}, g = Object.assign, _ = {};
	function v(e, t, n) {
		this.props = e, this.context = t, this.refs = _, this.updater = n || h;
	}
	v.prototype.isReactComponent = {}, v.prototype.setState = function(e, t) {
		if (typeof e != "object" && typeof e != "function" && e != null) throw Error("takes an object of state variables to update or a function which returns an object of state variables.");
		this.updater.enqueueSetState(this, e, t, "setState");
	}, v.prototype.forceUpdate = function(e) {
		this.updater.enqueueForceUpdate(this, e, "forceUpdate");
	};
	function y() {}
	y.prototype = v.prototype;
	function b(e, t, n) {
		this.props = e, this.context = t, this.refs = _, this.updater = n || h;
	}
	var x = b.prototype = new y();
	x.constructor = b, g(x, v.prototype), x.isPureReactComponent = !0;
	var S = Array.isArray;
	function C() {}
	var w = {
		H: null,
		A: null,
		T: null,
		S: null
	}, T = Object.prototype.hasOwnProperty;
	function E(e, n, r) {
		var i = r.ref;
		return {
			$$typeof: t,
			type: e,
			key: n,
			ref: i === void 0 ? null : i,
			props: r
		};
	}
	function D(e, t) {
		return E(e.type, t, e.props);
	}
	function O(e) {
		return typeof e == "object" && !!e && e.$$typeof === t;
	}
	function k(e) {
		var t = {
			"=": "=0",
			":": "=2"
		};
		return "$" + e.replace(/[=:]/g, function(e) {
			return t[e];
		});
	}
	var A = /\/+/g;
	function j(e, t) {
		return typeof e == "object" && e && e.key != null ? k("" + e.key) : t.toString(36);
	}
	function M(e) {
		switch (e.status) {
			case "fulfilled": return e.value;
			case "rejected": throw e.reason;
			default: switch (typeof e.status == "string" ? e.then(C, C) : (e.status = "pending", e.then(function(t) {
				e.status === "pending" && (e.status = "fulfilled", e.value = t);
			}, function(t) {
				e.status === "pending" && (e.status = "rejected", e.reason = t);
			})), e.status) {
				case "fulfilled": return e.value;
				case "rejected": throw e.reason;
			}
		}
		throw e;
	}
	function N(e, r, i, a, o) {
		var s = typeof e;
		(s === "undefined" || s === "boolean") && (e = null);
		var c = !1;
		if (e === null) c = !0;
		else switch (s) {
			case "bigint":
			case "string":
			case "number":
				c = !0;
				break;
			case "object": switch (e.$$typeof) {
				case t:
				case n:
					c = !0;
					break;
				case d: return c = e._init, N(c(e._payload), r, i, a, o);
			}
		}
		if (c) return o = o(e), c = a === "" ? "." + j(e, 0) : a, S(o) ? (i = "", c != null && (i = c.replace(A, "$&/") + "/"), N(o, r, i, "", function(e) {
			return e;
		})) : o != null && (O(o) && (o = D(o, i + (o.key == null || e && e.key === o.key ? "" : ("" + o.key).replace(A, "$&/") + "/") + c)), r.push(o)), 1;
		c = 0;
		var l = a === "" ? "." : a + ":";
		if (S(e)) for (var u = 0; u < e.length; u++) a = e[u], s = l + j(a, u), c += N(a, r, i, s, o);
		else if (u = m(e), typeof u == "function") for (e = u.call(e), u = 0; !(a = e.next()).done;) a = a.value, s = l + j(a, u++), c += N(a, r, i, s, o);
		else if (s === "object") {
			if (typeof e.then == "function") return N(M(e), r, i, a, o);
			throw r = String(e), Error("Objects are not valid as a React child (found: " + (r === "[object Object]" ? "object with keys {" + Object.keys(e).join(", ") + "}" : r) + "). If you meant to render a collection of children, use an array instead.");
		}
		return c;
	}
	function ee(e, t, n) {
		if (e == null) return e;
		var r = [], i = 0;
		return N(e, r, "", "", function(e) {
			return t.call(n, e, i++);
		}), r;
	}
	function P(e) {
		if (e._status === -1) {
			var t = e._result;
			t = t(), t.then(function(t) {
				(e._status === 0 || e._status === -1) && (e._status = 1, e._result = t);
			}, function(t) {
				(e._status === 0 || e._status === -1) && (e._status = 2, e._result = t);
			}), e._status === -1 && (e._status = 0, e._result = t);
		}
		if (e._status === 1) return e._result.default;
		throw e._result;
	}
	var F = typeof reportError == "function" ? reportError : function(e) {
		if (typeof window == "object" && typeof window.ErrorEvent == "function") {
			var t = new window.ErrorEvent("error", {
				bubbles: !0,
				cancelable: !0,
				message: typeof e == "object" && e && typeof e.message == "string" ? String(e.message) : String(e),
				error: e
			});
			if (!window.dispatchEvent(t)) return;
		} else if (typeof process == "object" && typeof process.emit == "function") {
			process.emit("uncaughtException", e);
			return;
		}
		console.error(e);
	}, I = {
		map: ee,
		forEach: function(e, t, n) {
			ee(e, function() {
				t.apply(this, arguments);
			}, n);
		},
		count: function(e) {
			var t = 0;
			return ee(e, function() {
				t++;
			}), t;
		},
		toArray: function(e) {
			return ee(e, function(e) {
				return e;
			}) || [];
		},
		only: function(e) {
			if (!O(e)) throw Error("React.Children.only expected to receive a single React element child.");
			return e;
		}
	};
	e.Activity = f, e.Children = I, e.Component = v, e.Fragment = r, e.Profiler = a, e.PureComponent = b, e.StrictMode = i, e.Suspense = l, e.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = w, e.__COMPILER_RUNTIME = {
		__proto__: null,
		c: function(e) {
			return w.H.useMemoCache(e);
		}
	}, e.cache = function(e) {
		return function() {
			return e.apply(null, arguments);
		};
	}, e.cacheSignal = function() {
		return null;
	}, e.cloneElement = function(e, t, n) {
		if (e == null) throw Error("The argument must be a React element, but you passed " + e + ".");
		var r = g({}, e.props), i = e.key;
		if (t != null) for (a in t.key !== void 0 && (i = "" + t.key), t) !T.call(t, a) || a === "key" || a === "__self" || a === "__source" || a === "ref" && t.ref === void 0 || (r[a] = t[a]);
		var a = arguments.length - 2;
		if (a === 1) r.children = n;
		else if (1 < a) {
			for (var o = Array(a), s = 0; s < a; s++) o[s] = arguments[s + 2];
			r.children = o;
		}
		return E(e.type, i, r);
	}, e.createContext = function(e) {
		return e = {
			$$typeof: s,
			_currentValue: e,
			_currentValue2: e,
			_threadCount: 0,
			Provider: null,
			Consumer: null
		}, e.Provider = e, e.Consumer = {
			$$typeof: o,
			_context: e
		}, e;
	}, e.createElement = function(e, t, n) {
		var r, i = {}, a = null;
		if (t != null) for (r in t.key !== void 0 && (a = "" + t.key), t) T.call(t, r) && r !== "key" && r !== "__self" && r !== "__source" && (i[r] = t[r]);
		var o = arguments.length - 2;
		if (o === 1) i.children = n;
		else if (1 < o) {
			for (var s = Array(o), c = 0; c < o; c++) s[c] = arguments[c + 2];
			i.children = s;
		}
		if (e && e.defaultProps) for (r in o = e.defaultProps, o) i[r] === void 0 && (i[r] = o[r]);
		return E(e, a, i);
	}, e.createRef = function() {
		return { current: null };
	}, e.forwardRef = function(e) {
		return {
			$$typeof: c,
			render: e
		};
	}, e.isValidElement = O, e.lazy = function(e) {
		return {
			$$typeof: d,
			_payload: {
				_status: -1,
				_result: e
			},
			_init: P
		};
	}, e.memo = function(e, t) {
		return {
			$$typeof: u,
			type: e,
			compare: t === void 0 ? null : t
		};
	}, e.startTransition = function(e) {
		var t = w.T, n = {};
		w.T = n;
		try {
			var r = e(), i = w.S;
			i !== null && i(n, r), typeof r == "object" && r && typeof r.then == "function" && r.then(C, F);
		} catch (e) {
			F(e);
		} finally {
			t !== null && n.types !== null && (t.types = n.types), w.T = t;
		}
	}, e.unstable_useCacheRefresh = function() {
		return w.H.useCacheRefresh();
	}, e.use = function(e) {
		return w.H.use(e);
	}, e.useActionState = function(e, t, n) {
		return w.H.useActionState(e, t, n);
	}, e.useCallback = function(e, t) {
		return w.H.useCallback(e, t);
	}, e.useContext = function(e) {
		return w.H.useContext(e);
	}, e.useDebugValue = function() {}, e.useDeferredValue = function(e, t) {
		return w.H.useDeferredValue(e, t);
	}, e.useEffect = function(e, t) {
		return w.H.useEffect(e, t);
	}, e.useEffectEvent = function(e) {
		return w.H.useEffectEvent(e);
	}, e.useId = function() {
		return w.H.useId();
	}, e.useImperativeHandle = function(e, t, n) {
		return w.H.useImperativeHandle(e, t, n);
	}, e.useInsertionEffect = function(e, t) {
		return w.H.useInsertionEffect(e, t);
	}, e.useLayoutEffect = function(e, t) {
		return w.H.useLayoutEffect(e, t);
	}, e.useMemo = function(e, t) {
		return w.H.useMemo(e, t);
	}, e.useOptimistic = function(e, t) {
		return w.H.useOptimistic(e, t);
	}, e.useReducer = function(e, t, n) {
		return w.H.useReducer(e, t, n);
	}, e.useRef = function(e) {
		return w.H.useRef(e);
	}, e.useState = function(e) {
		return w.H.useState(e);
	}, e.useSyncExternalStore = function(e, t, n) {
		return w.H.useSyncExternalStore(e, t, n);
	}, e.useTransition = function() {
		return w.H.useTransition();
	}, e.version = "19.2.7";
})), u = /* @__PURE__ */ o(((e, t) => {
	t.exports = l();
})), d = /* @__PURE__ */ o(((e) => {
	function t(e, t) {
		var n = e.length;
		e.push(t);
		a: for (; 0 < n;) {
			var r = n - 1 >>> 1, a = e[r];
			if (0 < i(a, t)) e[r] = t, e[n] = a, n = r;
			else break a;
		}
	}
	function n(e) {
		return e.length === 0 ? null : e[0];
	}
	function r(e) {
		if (e.length === 0) return null;
		var t = e[0], n = e.pop();
		if (n !== t) {
			e[0] = n;
			a: for (var r = 0, a = e.length, o = a >>> 1; r < o;) {
				var s = 2 * (r + 1) - 1, c = e[s], l = s + 1, u = e[l];
				if (0 > i(c, n)) l < a && 0 > i(u, c) ? (e[r] = u, e[l] = n, r = l) : (e[r] = c, e[s] = n, r = s);
				else if (l < a && 0 > i(u, n)) e[r] = u, e[l] = n, r = l;
				else break a;
			}
		}
		return t;
	}
	function i(e, t) {
		var n = e.sortIndex - t.sortIndex;
		return n === 0 ? e.id - t.id : n;
	}
	if (e.unstable_now = void 0, typeof performance == "object" && typeof performance.now == "function") {
		var a = performance;
		e.unstable_now = function() {
			return a.now();
		};
	} else {
		var o = Date, s = o.now();
		e.unstable_now = function() {
			return o.now() - s;
		};
	}
	var c = [], l = [], u = 1, d = null, f = 3, p = !1, m = !1, h = !1, g = !1, _ = typeof setTimeout == "function" ? setTimeout : null, v = typeof clearTimeout == "function" ? clearTimeout : null, y = typeof setImmediate < "u" ? setImmediate : null;
	function b(e) {
		for (var i = n(l); i !== null;) {
			if (i.callback === null) r(l);
			else if (i.startTime <= e) r(l), i.sortIndex = i.expirationTime, t(c, i);
			else break;
			i = n(l);
		}
	}
	function x(e) {
		if (h = !1, b(e), !m) if (n(c) !== null) m = !0, S || (S = !0, O());
		else {
			var t = n(l);
			t !== null && j(x, t.startTime - e);
		}
	}
	var S = !1, C = -1, w = 5, T = -1;
	function E() {
		return g ? !0 : !(e.unstable_now() - T < w);
	}
	function D() {
		if (g = !1, S) {
			var t = e.unstable_now();
			T = t;
			var i = !0;
			try {
				a: {
					m = !1, h && (h = !1, v(C), C = -1), p = !0;
					var a = f;
					try {
						b: {
							for (b(t), d = n(c); d !== null && !(d.expirationTime > t && E());) {
								var o = d.callback;
								if (typeof o == "function") {
									d.callback = null, f = d.priorityLevel;
									var s = o(d.expirationTime <= t);
									if (t = e.unstable_now(), typeof s == "function") {
										d.callback = s, b(t), i = !0;
										break b;
									}
									d === n(c) && r(c), b(t);
								} else r(c);
								d = n(c);
							}
							if (d !== null) i = !0;
							else {
								var u = n(l);
								u !== null && j(x, u.startTime - t), i = !1;
							}
						}
						break a;
					} finally {
						d = null, f = a, p = !1;
					}
					i = void 0;
				}
			} finally {
				i ? O() : S = !1;
			}
		}
	}
	var O;
	if (typeof y == "function") O = function() {
		y(D);
	};
	else if (typeof MessageChannel < "u") {
		var k = new MessageChannel(), A = k.port2;
		k.port1.onmessage = D, O = function() {
			A.postMessage(null);
		};
	} else O = function() {
		_(D, 0);
	};
	function j(t, n) {
		C = _(function() {
			t(e.unstable_now());
		}, n);
	}
	e.unstable_IdlePriority = 5, e.unstable_ImmediatePriority = 1, e.unstable_LowPriority = 4, e.unstable_NormalPriority = 3, e.unstable_Profiling = null, e.unstable_UserBlockingPriority = 2, e.unstable_cancelCallback = function(e) {
		e.callback = null;
	}, e.unstable_forceFrameRate = function(e) {
		0 > e || 125 < e ? console.error("forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported") : w = 0 < e ? Math.floor(1e3 / e) : 5;
	}, e.unstable_getCurrentPriorityLevel = function() {
		return f;
	}, e.unstable_next = function(e) {
		switch (f) {
			case 1:
			case 2:
			case 3:
				var t = 3;
				break;
			default: t = f;
		}
		var n = f;
		f = t;
		try {
			return e();
		} finally {
			f = n;
		}
	}, e.unstable_requestPaint = function() {
		g = !0;
	}, e.unstable_runWithPriority = function(e, t) {
		switch (e) {
			case 1:
			case 2:
			case 3:
			case 4:
			case 5: break;
			default: e = 3;
		}
		var n = f;
		f = e;
		try {
			return t();
		} finally {
			f = n;
		}
	}, e.unstable_scheduleCallback = function(r, i, a) {
		var o = e.unstable_now();
		switch (typeof a == "object" && a ? (a = a.delay, a = typeof a == "number" && 0 < a ? o + a : o) : a = o, r) {
			case 1:
				var s = -1;
				break;
			case 2:
				s = 250;
				break;
			case 5:
				s = 1073741823;
				break;
			case 4:
				s = 1e4;
				break;
			default: s = 5e3;
		}
		return s = a + s, r = {
			id: u++,
			callback: i,
			priorityLevel: r,
			startTime: a,
			expirationTime: s,
			sortIndex: -1
		}, a > o ? (r.sortIndex = a, t(l, r), n(c) === null && r === n(l) && (h ? (v(C), C = -1) : h = !0, j(x, a - o))) : (r.sortIndex = s, t(c, r), m || p || (m = !0, S || (S = !0, O()))), r;
	}, e.unstable_shouldYield = E, e.unstable_wrapCallback = function(e) {
		var t = f;
		return function() {
			var n = f;
			f = t;
			try {
				return e.apply(this, arguments);
			} finally {
				f = n;
			}
		};
	};
})), f = /* @__PURE__ */ o(((e, t) => {
	t.exports = d();
})), p = /* @__PURE__ */ o(((e) => {
	var t = u();
	function n(e) {
		var t = "https://react.dev/errors/" + e;
		if (1 < arguments.length) {
			t += "?args[]=" + encodeURIComponent(arguments[1]);
			for (var n = 2; n < arguments.length; n++) t += "&args[]=" + encodeURIComponent(arguments[n]);
		}
		return "Minified React error #" + e + "; visit " + t + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
	}
	function r() {}
	var i = {
		d: {
			f: r,
			r: function() {
				throw Error(n(522));
			},
			D: r,
			C: r,
			L: r,
			m: r,
			X: r,
			S: r,
			M: r
		},
		p: 0,
		findDOMNode: null
	}, a = Symbol.for("react.portal");
	function o(e, t, n) {
		var r = 3 < arguments.length && arguments[3] !== void 0 ? arguments[3] : null;
		return {
			$$typeof: a,
			key: r == null ? null : "" + r,
			children: e,
			containerInfo: t,
			implementation: n
		};
	}
	var s = t.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
	function c(e, t) {
		if (e === "font") return "";
		if (typeof t == "string") return t === "use-credentials" ? t : "";
	}
	e.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = i, e.createPortal = function(e, t) {
		var r = 2 < arguments.length && arguments[2] !== void 0 ? arguments[2] : null;
		if (!t || t.nodeType !== 1 && t.nodeType !== 9 && t.nodeType !== 11) throw Error(n(299));
		return o(e, t, null, r);
	}, e.flushSync = function(e) {
		var t = s.T, n = i.p;
		try {
			if (s.T = null, i.p = 2, e) return e();
		} finally {
			s.T = t, i.p = n, i.d.f();
		}
	}, e.preconnect = function(e, t) {
		typeof e == "string" && (t ? (t = t.crossOrigin, t = typeof t == "string" ? t === "use-credentials" ? t : "" : void 0) : t = null, i.d.C(e, t));
	}, e.prefetchDNS = function(e) {
		typeof e == "string" && i.d.D(e);
	}, e.preinit = function(e, t) {
		if (typeof e == "string" && t && typeof t.as == "string") {
			var n = t.as, r = c(n, t.crossOrigin), a = typeof t.integrity == "string" ? t.integrity : void 0, o = typeof t.fetchPriority == "string" ? t.fetchPriority : void 0;
			n === "style" ? i.d.S(e, typeof t.precedence == "string" ? t.precedence : void 0, {
				crossOrigin: r,
				integrity: a,
				fetchPriority: o
			}) : n === "script" && i.d.X(e, {
				crossOrigin: r,
				integrity: a,
				fetchPriority: o,
				nonce: typeof t.nonce == "string" ? t.nonce : void 0
			});
		}
	}, e.preinitModule = function(e, t) {
		if (typeof e == "string") if (typeof t == "object" && t) {
			if (t.as == null || t.as === "script") {
				var n = c(t.as, t.crossOrigin);
				i.d.M(e, {
					crossOrigin: n,
					integrity: typeof t.integrity == "string" ? t.integrity : void 0,
					nonce: typeof t.nonce == "string" ? t.nonce : void 0
				});
			}
		} else t ?? i.d.M(e);
	}, e.preload = function(e, t) {
		if (typeof e == "string" && typeof t == "object" && t && typeof t.as == "string") {
			var n = t.as, r = c(n, t.crossOrigin);
			i.d.L(e, n, {
				crossOrigin: r,
				integrity: typeof t.integrity == "string" ? t.integrity : void 0,
				nonce: typeof t.nonce == "string" ? t.nonce : void 0,
				type: typeof t.type == "string" ? t.type : void 0,
				fetchPriority: typeof t.fetchPriority == "string" ? t.fetchPriority : void 0,
				referrerPolicy: typeof t.referrerPolicy == "string" ? t.referrerPolicy : void 0,
				imageSrcSet: typeof t.imageSrcSet == "string" ? t.imageSrcSet : void 0,
				imageSizes: typeof t.imageSizes == "string" ? t.imageSizes : void 0,
				media: typeof t.media == "string" ? t.media : void 0
			});
		}
	}, e.preloadModule = function(e, t) {
		if (typeof e == "string") if (t) {
			var n = c(t.as, t.crossOrigin);
			i.d.m(e, {
				as: typeof t.as == "string" && t.as !== "script" ? t.as : void 0,
				crossOrigin: n,
				integrity: typeof t.integrity == "string" ? t.integrity : void 0
			});
		} else i.d.m(e);
	}, e.requestFormReset = function(e) {
		i.d.r(e);
	}, e.unstable_batchedUpdates = function(e, t) {
		return e(t);
	}, e.useFormState = function(e, t, n) {
		return s.H.useFormState(e, t, n);
	}, e.useFormStatus = function() {
		return s.H.useHostTransitionStatus();
	}, e.version = "19.2.7";
})), m = /* @__PURE__ */ o(((e, t) => {
	function n() {
		if (!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u" || typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE != "function")) try {
			__REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(n);
		} catch (e) {
			console.error(e);
		}
	}
	n(), t.exports = p();
})), h = /* @__PURE__ */ o(((e) => {
	var t = f(), n = u(), r = m();
	function i(e) {
		var t = "https://react.dev/errors/" + e;
		if (1 < arguments.length) {
			t += "?args[]=" + encodeURIComponent(arguments[1]);
			for (var n = 2; n < arguments.length; n++) t += "&args[]=" + encodeURIComponent(arguments[n]);
		}
		return "Minified React error #" + e + "; visit " + t + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
	}
	function a(e) {
		return !(!e || e.nodeType !== 1 && e.nodeType !== 9 && e.nodeType !== 11);
	}
	function o(e) {
		var t = e, n = e;
		if (e.alternate) for (; t.return;) t = t.return;
		else {
			e = t;
			do
				t = e, t.flags & 4098 && (n = t.return), e = t.return;
			while (e);
		}
		return t.tag === 3 ? n : null;
	}
	function s(e) {
		if (e.tag === 13) {
			var t = e.memoizedState;
			if (t === null && (e = e.alternate, e !== null && (t = e.memoizedState)), t !== null) return t.dehydrated;
		}
		return null;
	}
	function c(e) {
		if (e.tag === 31) {
			var t = e.memoizedState;
			if (t === null && (e = e.alternate, e !== null && (t = e.memoizedState)), t !== null) return t.dehydrated;
		}
		return null;
	}
	function l(e) {
		if (o(e) !== e) throw Error(i(188));
	}
	function d(e) {
		var t = e.alternate;
		if (!t) {
			if (t = o(e), t === null) throw Error(i(188));
			return t === e ? e : null;
		}
		for (var n = e, r = t;;) {
			var a = n.return;
			if (a === null) break;
			var s = a.alternate;
			if (s === null) {
				if (r = a.return, r !== null) {
					n = r;
					continue;
				}
				break;
			}
			if (a.child === s.child) {
				for (s = a.child; s;) {
					if (s === n) return l(a), e;
					if (s === r) return l(a), t;
					s = s.sibling;
				}
				throw Error(i(188));
			}
			if (n.return !== r.return) n = a, r = s;
			else {
				for (var c = !1, u = a.child; u;) {
					if (u === n) {
						c = !0, n = a, r = s;
						break;
					}
					if (u === r) {
						c = !0, r = a, n = s;
						break;
					}
					u = u.sibling;
				}
				if (!c) {
					for (u = s.child; u;) {
						if (u === n) {
							c = !0, n = s, r = a;
							break;
						}
						if (u === r) {
							c = !0, r = s, n = a;
							break;
						}
						u = u.sibling;
					}
					if (!c) throw Error(i(189));
				}
			}
			if (n.alternate !== r) throw Error(i(190));
		}
		if (n.tag !== 3) throw Error(i(188));
		return n.stateNode.current === n ? e : t;
	}
	function p(e) {
		var t = e.tag;
		if (t === 5 || t === 26 || t === 27 || t === 6) return e;
		for (e = e.child; e !== null;) {
			if (t = p(e), t !== null) return t;
			e = e.sibling;
		}
		return null;
	}
	var h = Object.assign, g = Symbol.for("react.element"), _ = Symbol.for("react.transitional.element"), v = Symbol.for("react.portal"), y = Symbol.for("react.fragment"), b = Symbol.for("react.strict_mode"), x = Symbol.for("react.profiler"), S = Symbol.for("react.consumer"), C = Symbol.for("react.context"), w = Symbol.for("react.forward_ref"), T = Symbol.for("react.suspense"), E = Symbol.for("react.suspense_list"), D = Symbol.for("react.memo"), O = Symbol.for("react.lazy"), k = Symbol.for("react.activity"), A = Symbol.for("react.memo_cache_sentinel"), j = Symbol.iterator;
	function M(e) {
		return typeof e != "object" || !e ? null : (e = j && e[j] || e["@@iterator"], typeof e == "function" ? e : null);
	}
	var N = Symbol.for("react.client.reference");
	function ee(e) {
		if (e == null) return null;
		if (typeof e == "function") return e.$$typeof === N ? null : e.displayName || e.name || null;
		if (typeof e == "string") return e;
		switch (e) {
			case y: return "Fragment";
			case x: return "Profiler";
			case b: return "StrictMode";
			case T: return "Suspense";
			case E: return "SuspenseList";
			case k: return "Activity";
		}
		if (typeof e == "object") switch (e.$$typeof) {
			case v: return "Portal";
			case C: return e.displayName || "Context";
			case S: return (e._context.displayName || "Context") + ".Consumer";
			case w:
				var t = e.render;
				return e = e.displayName, e ||= (e = t.displayName || t.name || "", e === "" ? "ForwardRef" : "ForwardRef(" + e + ")"), e;
			case D: return t = e.displayName || null, t === null ? ee(e.type) || "Memo" : t;
			case O:
				t = e._payload, e = e._init;
				try {
					return ee(e(t));
				} catch {}
		}
		return null;
	}
	var P = Array.isArray, F = n.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, I = r.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, te = {
		pending: !1,
		data: null,
		method: null,
		action: null
	}, L = [], ne = -1;
	function re(e) {
		return { current: e };
	}
	function ie(e) {
		0 > ne || (e.current = L[ne], L[ne] = null, ne--);
	}
	function R(e, t) {
		ne++, L[ne] = e.current, e.current = t;
	}
	var ae = re(null), oe = re(null), se = re(null), ce = re(null);
	function le(e, t) {
		switch (R(se, t), R(oe, e), R(ae, null), t.nodeType) {
			case 9:
			case 11:
				e = (e = t.documentElement) && (e = e.namespaceURI) ? Vd(e) : 0;
				break;
			default: if (e = t.tagName, t = t.namespaceURI) t = Vd(t), e = Hd(t, e);
			else switch (e) {
				case "svg":
					e = 1;
					break;
				case "math":
					e = 2;
					break;
				default: e = 0;
			}
		}
		ie(ae), R(ae, e);
	}
	function ue() {
		ie(ae), ie(oe), ie(se);
	}
	function de(e) {
		e.memoizedState !== null && R(ce, e);
		var t = ae.current, n = Hd(t, e.type);
		t !== n && (R(oe, e), R(ae, n));
	}
	function fe(e) {
		oe.current === e && (ie(ae), ie(oe)), ce.current === e && (ie(ce), Qf._currentValue = te);
	}
	var pe, me;
	function he(e) {
		if (pe === void 0) try {
			throw Error();
		} catch (e) {
			var t = e.stack.trim().match(/\n( *(at )?)/);
			pe = t && t[1] || "", me = -1 < e.stack.indexOf("\n    at") ? " (<anonymous>)" : -1 < e.stack.indexOf("@") ? "@unknown:0:0" : "";
		}
		return "\n" + pe + e + me;
	}
	var ge = !1;
	function _e(e, t) {
		if (!e || ge) return "";
		ge = !0;
		var n = Error.prepareStackTrace;
		Error.prepareStackTrace = void 0;
		try {
			var r = { DetermineComponentFrameRoot: function() {
				try {
					if (t) {
						var n = function() {
							throw Error();
						};
						if (Object.defineProperty(n.prototype, "props", { set: function() {
							throw Error();
						} }), typeof Reflect == "object" && Reflect.construct) {
							try {
								Reflect.construct(n, []);
							} catch (e) {
								var r = e;
							}
							Reflect.construct(e, [], n);
						} else {
							try {
								n.call();
							} catch (e) {
								r = e;
							}
							e.call(n.prototype);
						}
					} else {
						try {
							throw Error();
						} catch (e) {
							r = e;
						}
						(n = e()) && typeof n.catch == "function" && n.catch(function() {});
					}
				} catch (e) {
					if (e && r && typeof e.stack == "string") return [e.stack, r.stack];
				}
				return [null, null];
			} };
			r.DetermineComponentFrameRoot.displayName = "DetermineComponentFrameRoot";
			var i = Object.getOwnPropertyDescriptor(r.DetermineComponentFrameRoot, "name");
			i && i.configurable && Object.defineProperty(r.DetermineComponentFrameRoot, "name", { value: "DetermineComponentFrameRoot" });
			var a = r.DetermineComponentFrameRoot(), o = a[0], s = a[1];
			if (o && s) {
				var c = o.split("\n"), l = s.split("\n");
				for (i = r = 0; r < c.length && !c[r].includes("DetermineComponentFrameRoot");) r++;
				for (; i < l.length && !l[i].includes("DetermineComponentFrameRoot");) i++;
				if (r === c.length || i === l.length) for (r = c.length - 1, i = l.length - 1; 1 <= r && 0 <= i && c[r] !== l[i];) i--;
				for (; 1 <= r && 0 <= i; r--, i--) if (c[r] !== l[i]) {
					if (r !== 1 || i !== 1) do
						if (r--, i--, 0 > i || c[r] !== l[i]) {
							var u = "\n" + c[r].replace(" at new ", " at ");
							return e.displayName && u.includes("<anonymous>") && (u = u.replace("<anonymous>", e.displayName)), u;
						}
					while (1 <= r && 0 <= i);
					break;
				}
			}
		} finally {
			ge = !1, Error.prepareStackTrace = n;
		}
		return (n = e ? e.displayName || e.name : "") ? he(n) : "";
	}
	function ve(e, t) {
		switch (e.tag) {
			case 26:
			case 27:
			case 5: return he(e.type);
			case 16: return he("Lazy");
			case 13: return e.child !== t && t !== null ? he("Suspense Fallback") : he("Suspense");
			case 19: return he("SuspenseList");
			case 0:
			case 15: return _e(e.type, !1);
			case 11: return _e(e.type.render, !1);
			case 1: return _e(e.type, !0);
			case 31: return he("Activity");
			default: return "";
		}
	}
	function ye(e) {
		try {
			var t = "", n = null;
			do
				t += ve(e, n), n = e, e = e.return;
			while (e);
			return t;
		} catch (e) {
			return "\nError generating stack: " + e.message + "\n" + e.stack;
		}
	}
	var be = Object.prototype.hasOwnProperty, xe = t.unstable_scheduleCallback, Se = t.unstable_cancelCallback, Ce = t.unstable_shouldYield, we = t.unstable_requestPaint, z = t.unstable_now, Te = t.unstable_getCurrentPriorityLevel, Ee = t.unstable_ImmediatePriority, De = t.unstable_UserBlockingPriority, Oe = t.unstable_NormalPriority, ke = t.unstable_LowPriority, Ae = t.unstable_IdlePriority, je = t.log, Me = t.unstable_setDisableYieldValue, Ne = null, B = null;
	function Pe(e) {
		if (typeof je == "function" && Me(e), B && typeof B.setStrictMode == "function") try {
			B.setStrictMode(Ne, e);
		} catch {}
	}
	var Fe = Math.clz32 ? Math.clz32 : Re, Ie = Math.log, Le = Math.LN2;
	function Re(e) {
		return e >>>= 0, e === 0 ? 32 : 31 - (Ie(e) / Le | 0) | 0;
	}
	var ze = 256, Be = 262144, Ve = 4194304;
	function He(e) {
		var t = e & 42;
		if (t !== 0) return t;
		switch (e & -e) {
			case 1: return 1;
			case 2: return 2;
			case 4: return 4;
			case 8: return 8;
			case 16: return 16;
			case 32: return 32;
			case 64: return 64;
			case 128: return 128;
			case 256:
			case 512:
			case 1024:
			case 2048:
			case 4096:
			case 8192:
			case 16384:
			case 32768:
			case 65536:
			case 131072: return e & 261888;
			case 262144:
			case 524288:
			case 1048576:
			case 2097152: return e & 3932160;
			case 4194304:
			case 8388608:
			case 16777216:
			case 33554432: return e & 62914560;
			case 67108864: return 67108864;
			case 134217728: return 134217728;
			case 268435456: return 268435456;
			case 536870912: return 536870912;
			case 1073741824: return 0;
			default: return e;
		}
	}
	function V(e, t, n) {
		var r = e.pendingLanes;
		if (r === 0) return 0;
		var i = 0, a = e.suspendedLanes, o = e.pingedLanes;
		e = e.warmLanes;
		var s = r & 134217727;
		return s === 0 ? (s = r & ~a, s === 0 ? o === 0 ? n || (n = r & ~e, n !== 0 && (i = He(n))) : i = He(o) : i = He(s)) : (r = s & ~a, r === 0 ? (o &= s, o === 0 ? n || (n = s & ~e, n !== 0 && (i = He(n))) : i = He(o)) : i = He(r)), i === 0 ? 0 : t !== 0 && t !== i && (t & a) === 0 && (a = i & -i, n = t & -t, a >= n || a === 32 && n & 4194048) ? t : i;
	}
	function Ue(e, t) {
		return (e.pendingLanes & ~(e.suspendedLanes & ~e.pingedLanes) & t) === 0;
	}
	function We(e, t) {
		switch (e) {
			case 1:
			case 2:
			case 4:
			case 8:
			case 64: return t + 250;
			case 16:
			case 32:
			case 128:
			case 256:
			case 512:
			case 1024:
			case 2048:
			case 4096:
			case 8192:
			case 16384:
			case 32768:
			case 65536:
			case 131072:
			case 262144:
			case 524288:
			case 1048576:
			case 2097152: return t + 5e3;
			case 4194304:
			case 8388608:
			case 16777216:
			case 33554432: return -1;
			case 67108864:
			case 134217728:
			case 268435456:
			case 536870912:
			case 1073741824: return -1;
			default: return -1;
		}
	}
	function Ge() {
		var e = Ve;
		return Ve <<= 1, !(Ve & 62914560) && (Ve = 4194304), e;
	}
	function Ke(e) {
		for (var t = [], n = 0; 31 > n; n++) t.push(e);
		return t;
	}
	function qe(e, t) {
		e.pendingLanes |= t, t !== 268435456 && (e.suspendedLanes = 0, e.pingedLanes = 0, e.warmLanes = 0);
	}
	function Je(e, t, n, r, i, a) {
		var o = e.pendingLanes;
		e.pendingLanes = n, e.suspendedLanes = 0, e.pingedLanes = 0, e.warmLanes = 0, e.expiredLanes &= n, e.entangledLanes &= n, e.errorRecoveryDisabledLanes &= n, e.shellSuspendCounter = 0;
		var s = e.entanglements, c = e.expirationTimes, l = e.hiddenUpdates;
		for (n = o & ~n; 0 < n;) {
			var u = 31 - Fe(n), d = 1 << u;
			s[u] = 0, c[u] = -1;
			var f = l[u];
			if (f !== null) for (l[u] = null, u = 0; u < f.length; u++) {
				var p = f[u];
				p !== null && (p.lane &= -536870913);
			}
			n &= ~d;
		}
		r !== 0 && Ye(e, r, 0), a !== 0 && i === 0 && e.tag !== 0 && (e.suspendedLanes |= a & ~(o & ~t));
	}
	function Ye(e, t, n) {
		e.pendingLanes |= t, e.suspendedLanes &= ~t;
		var r = 31 - Fe(t);
		e.entangledLanes |= t, e.entanglements[r] = e.entanglements[r] | 1073741824 | n & 261930;
	}
	function Xe(e, t) {
		var n = e.entangledLanes |= t;
		for (e = e.entanglements; n;) {
			var r = 31 - Fe(n), i = 1 << r;
			i & t | e[r] & t && (e[r] |= t), n &= ~i;
		}
	}
	function Ze(e, t) {
		var n = t & -t;
		return n = n & 42 ? 1 : Qe(n), (n & (e.suspendedLanes | t)) === 0 ? n : 0;
	}
	function Qe(e) {
		switch (e) {
			case 2:
				e = 1;
				break;
			case 8:
				e = 4;
				break;
			case 32:
				e = 16;
				break;
			case 256:
			case 512:
			case 1024:
			case 2048:
			case 4096:
			case 8192:
			case 16384:
			case 32768:
			case 65536:
			case 131072:
			case 262144:
			case 524288:
			case 1048576:
			case 2097152:
			case 4194304:
			case 8388608:
			case 16777216:
			case 33554432:
				e = 128;
				break;
			case 268435456:
				e = 134217728;
				break;
			default: e = 0;
		}
		return e;
	}
	function $e(e) {
		return e &= -e, 2 < e ? 8 < e ? e & 134217727 ? 32 : 268435456 : 8 : 2;
	}
	function et() {
		var e = I.p;
		return e === 0 ? (e = window.event, e === void 0 ? 32 : mp(e.type)) : e;
	}
	function tt(e, t) {
		var n = I.p;
		try {
			return I.p = e, t();
		} finally {
			I.p = n;
		}
	}
	var nt = Math.random().toString(36).slice(2), rt = "__reactFiber$" + nt, it = "__reactProps$" + nt, at = "__reactContainer$" + nt, H = "__reactEvents$" + nt, U = "__reactListeners$" + nt, ot = "__reactHandles$" + nt, st = "__reactResources$" + nt, ct = "__reactMarker$" + nt;
	function lt(e) {
		delete e[rt], delete e[it], delete e[H], delete e[U], delete e[ot];
	}
	function ut(e) {
		var t = e[rt];
		if (t) return t;
		for (var n = e.parentNode; n;) {
			if (t = n[at] || n[rt]) {
				if (n = t.alternate, t.child !== null || n !== null && n.child !== null) for (e = df(e); e !== null;) {
					if (n = e[rt]) return n;
					e = df(e);
				}
				return t;
			}
			e = n, n = e.parentNode;
		}
		return null;
	}
	function dt(e) {
		if (e = e[rt] || e[at]) {
			var t = e.tag;
			if (t === 5 || t === 6 || t === 13 || t === 31 || t === 26 || t === 27 || t === 3) return e;
		}
		return null;
	}
	function ft(e) {
		var t = e.tag;
		if (t === 5 || t === 26 || t === 27 || t === 6) return e.stateNode;
		throw Error(i(33));
	}
	function pt(e) {
		var t = e[st];
		return t ||= e[st] = {
			hoistableStyles: /* @__PURE__ */ new Map(),
			hoistableScripts: /* @__PURE__ */ new Map()
		}, t;
	}
	function mt(e) {
		e[ct] = !0;
	}
	var ht = /* @__PURE__ */ new Set(), gt = {};
	function _t(e, t) {
		vt(e, t), vt(e + "Capture", t);
	}
	function vt(e, t) {
		for (gt[e] = t, e = 0; e < t.length; e++) ht.add(t[e]);
	}
	var yt = RegExp("^[:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD][:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040]*$"), bt = {}, xt = {};
	function St(e) {
		return be.call(xt, e) ? !0 : be.call(bt, e) ? !1 : yt.test(e) ? xt[e] = !0 : (bt[e] = !0, !1);
	}
	function Ct(e, t, n) {
		if (St(t)) if (n === null) e.removeAttribute(t);
		else {
			switch (typeof n) {
				case "undefined":
				case "function":
				case "symbol":
					e.removeAttribute(t);
					return;
				case "boolean":
					var r = t.toLowerCase().slice(0, 5);
					if (r !== "data-" && r !== "aria-") {
						e.removeAttribute(t);
						return;
					}
			}
			e.setAttribute(t, "" + n);
		}
	}
	function wt(e, t, n) {
		if (n === null) e.removeAttribute(t);
		else {
			switch (typeof n) {
				case "undefined":
				case "function":
				case "symbol":
				case "boolean":
					e.removeAttribute(t);
					return;
			}
			e.setAttribute(t, "" + n);
		}
	}
	function Tt(e, t, n, r) {
		if (r === null) e.removeAttribute(n);
		else {
			switch (typeof r) {
				case "undefined":
				case "function":
				case "symbol":
				case "boolean":
					e.removeAttribute(n);
					return;
			}
			e.setAttributeNS(t, n, "" + r);
		}
	}
	function Et(e) {
		switch (typeof e) {
			case "bigint":
			case "boolean":
			case "number":
			case "string":
			case "undefined": return e;
			case "object": return e;
			default: return "";
		}
	}
	function Dt(e) {
		var t = e.type;
		return (e = e.nodeName) && e.toLowerCase() === "input" && (t === "checkbox" || t === "radio");
	}
	function Ot(e, t, n) {
		var r = Object.getOwnPropertyDescriptor(e.constructor.prototype, t);
		if (!e.hasOwnProperty(t) && r !== void 0 && typeof r.get == "function" && typeof r.set == "function") {
			var i = r.get, a = r.set;
			return Object.defineProperty(e, t, {
				configurable: !0,
				get: function() {
					return i.call(this);
				},
				set: function(e) {
					n = "" + e, a.call(this, e);
				}
			}), Object.defineProperty(e, t, { enumerable: r.enumerable }), {
				getValue: function() {
					return n;
				},
				setValue: function(e) {
					n = "" + e;
				},
				stopTracking: function() {
					e._valueTracker = null, delete e[t];
				}
			};
		}
	}
	function kt(e) {
		if (!e._valueTracker) {
			var t = Dt(e) ? "checked" : "value";
			e._valueTracker = Ot(e, t, "" + e[t]);
		}
	}
	function At(e) {
		if (!e) return !1;
		var t = e._valueTracker;
		if (!t) return !0;
		var n = t.getValue(), r = "";
		return e && (r = Dt(e) ? e.checked ? "true" : "false" : e.value), e = r, e === n ? !1 : (t.setValue(e), !0);
	}
	function jt(e) {
		if (e ||= typeof document < "u" ? document : void 0, e === void 0) return null;
		try {
			return e.activeElement || e.body;
		} catch {
			return e.body;
		}
	}
	var Mt = /[\n"\\]/g;
	function Nt(e) {
		return e.replace(Mt, function(e) {
			return "\\" + e.charCodeAt(0).toString(16) + " ";
		});
	}
	function Pt(e, t, n, r, i, a, o, s) {
		e.name = "", o != null && typeof o != "function" && typeof o != "symbol" && typeof o != "boolean" ? e.type = o : e.removeAttribute("type"), t == null ? o !== "submit" && o !== "reset" || e.removeAttribute("value") : o === "number" ? (t === 0 && e.value === "" || e.value != t) && (e.value = "" + Et(t)) : e.value !== "" + Et(t) && (e.value = "" + Et(t)), t == null ? n == null ? r != null && e.removeAttribute("value") : It(e, o, Et(n)) : It(e, o, Et(t)), i == null && a != null && (e.defaultChecked = !!a), i != null && (e.checked = i && typeof i != "function" && typeof i != "symbol"), s != null && typeof s != "function" && typeof s != "symbol" && typeof s != "boolean" ? e.name = "" + Et(s) : e.removeAttribute("name");
	}
	function Ft(e, t, n, r, i, a, o, s) {
		if (a != null && typeof a != "function" && typeof a != "symbol" && typeof a != "boolean" && (e.type = a), t != null || n != null) {
			if (!(a !== "submit" && a !== "reset" || t != null)) {
				kt(e);
				return;
			}
			n = n == null ? "" : "" + Et(n), t = t == null ? n : "" + Et(t), s || t === e.value || (e.value = t), e.defaultValue = t;
		}
		r ??= i, r = typeof r != "function" && typeof r != "symbol" && !!r, e.checked = s ? e.checked : !!r, e.defaultChecked = !!r, o != null && typeof o != "function" && typeof o != "symbol" && typeof o != "boolean" && (e.name = o), kt(e);
	}
	function It(e, t, n) {
		t === "number" && jt(e.ownerDocument) === e || e.defaultValue === "" + n || (e.defaultValue = "" + n);
	}
	function Lt(e, t, n, r) {
		if (e = e.options, t) {
			t = {};
			for (var i = 0; i < n.length; i++) t["$" + n[i]] = !0;
			for (n = 0; n < e.length; n++) i = t.hasOwnProperty("$" + e[n].value), e[n].selected !== i && (e[n].selected = i), i && r && (e[n].defaultSelected = !0);
		} else {
			for (n = "" + Et(n), t = null, i = 0; i < e.length; i++) {
				if (e[i].value === n) {
					e[i].selected = !0, r && (e[i].defaultSelected = !0);
					return;
				}
				t !== null || e[i].disabled || (t = e[i]);
			}
			t !== null && (t.selected = !0);
		}
	}
	function Rt(e, t, n) {
		if (t != null && (t = "" + Et(t), t !== e.value && (e.value = t), n == null)) {
			e.defaultValue !== t && (e.defaultValue = t);
			return;
		}
		e.defaultValue = n == null ? "" : "" + Et(n);
	}
	function zt(e, t, n, r) {
		if (t == null) {
			if (r != null) {
				if (n != null) throw Error(i(92));
				if (P(r)) {
					if (1 < r.length) throw Error(i(93));
					r = r[0];
				}
				n = r;
			}
			n ??= "", t = n;
		}
		n = Et(t), e.defaultValue = n, r = e.textContent, r === n && r !== "" && r !== null && (e.value = r), kt(e);
	}
	function Bt(e, t) {
		if (t) {
			var n = e.firstChild;
			if (n && n === e.lastChild && n.nodeType === 3) {
				n.nodeValue = t;
				return;
			}
		}
		e.textContent = t;
	}
	var Vt = new Set("animationIterationCount aspectRatio borderImageOutset borderImageSlice borderImageWidth boxFlex boxFlexGroup boxOrdinalGroup columnCount columns flex flexGrow flexPositive flexShrink flexNegative flexOrder gridArea gridRow gridRowEnd gridRowSpan gridRowStart gridColumn gridColumnEnd gridColumnSpan gridColumnStart fontWeight lineClamp lineHeight opacity order orphans scale tabSize widows zIndex zoom fillOpacity floodOpacity stopOpacity strokeDasharray strokeDashoffset strokeMiterlimit strokeOpacity strokeWidth MozAnimationIterationCount MozBoxFlex MozBoxFlexGroup MozLineClamp msAnimationIterationCount msFlex msZoom msFlexGrow msFlexNegative msFlexOrder msFlexPositive msFlexShrink msGridColumn msGridColumnSpan msGridRow msGridRowSpan WebkitAnimationIterationCount WebkitBoxFlex WebKitBoxFlexGroup WebkitBoxOrdinalGroup WebkitColumnCount WebkitColumns WebkitFlex WebkitFlexGrow WebkitFlexPositive WebkitFlexShrink WebkitLineClamp".split(" "));
	function Ht(e, t, n) {
		var r = t.indexOf("--") === 0;
		n == null || typeof n == "boolean" || n === "" ? r ? e.setProperty(t, "") : t === "float" ? e.cssFloat = "" : e[t] = "" : r ? e.setProperty(t, n) : typeof n != "number" || n === 0 || Vt.has(t) ? t === "float" ? e.cssFloat = n : e[t] = ("" + n).trim() : e[t] = n + "px";
	}
	function Ut(e, t, n) {
		if (t != null && typeof t != "object") throw Error(i(62));
		if (e = e.style, n != null) {
			for (var r in n) !n.hasOwnProperty(r) || t != null && t.hasOwnProperty(r) || (r.indexOf("--") === 0 ? e.setProperty(r, "") : r === "float" ? e.cssFloat = "" : e[r] = "");
			for (var a in t) r = t[a], t.hasOwnProperty(a) && n[a] !== r && Ht(e, a, r);
		} else for (var o in t) t.hasOwnProperty(o) && Ht(e, o, t[o]);
	}
	function Wt(e) {
		if (e.indexOf("-") === -1) return !1;
		switch (e) {
			case "annotation-xml":
			case "color-profile":
			case "font-face":
			case "font-face-src":
			case "font-face-uri":
			case "font-face-format":
			case "font-face-name":
			case "missing-glyph": return !1;
			default: return !0;
		}
	}
	var Gt = /* @__PURE__ */ new Map([
		["acceptCharset", "accept-charset"],
		["htmlFor", "for"],
		["httpEquiv", "http-equiv"],
		["crossOrigin", "crossorigin"],
		["accentHeight", "accent-height"],
		["alignmentBaseline", "alignment-baseline"],
		["arabicForm", "arabic-form"],
		["baselineShift", "baseline-shift"],
		["capHeight", "cap-height"],
		["clipPath", "clip-path"],
		["clipRule", "clip-rule"],
		["colorInterpolation", "color-interpolation"],
		["colorInterpolationFilters", "color-interpolation-filters"],
		["colorProfile", "color-profile"],
		["colorRendering", "color-rendering"],
		["dominantBaseline", "dominant-baseline"],
		["enableBackground", "enable-background"],
		["fillOpacity", "fill-opacity"],
		["fillRule", "fill-rule"],
		["floodColor", "flood-color"],
		["floodOpacity", "flood-opacity"],
		["fontFamily", "font-family"],
		["fontSize", "font-size"],
		["fontSizeAdjust", "font-size-adjust"],
		["fontStretch", "font-stretch"],
		["fontStyle", "font-style"],
		["fontVariant", "font-variant"],
		["fontWeight", "font-weight"],
		["glyphName", "glyph-name"],
		["glyphOrientationHorizontal", "glyph-orientation-horizontal"],
		["glyphOrientationVertical", "glyph-orientation-vertical"],
		["horizAdvX", "horiz-adv-x"],
		["horizOriginX", "horiz-origin-x"],
		["imageRendering", "image-rendering"],
		["letterSpacing", "letter-spacing"],
		["lightingColor", "lighting-color"],
		["markerEnd", "marker-end"],
		["markerMid", "marker-mid"],
		["markerStart", "marker-start"],
		["overlinePosition", "overline-position"],
		["overlineThickness", "overline-thickness"],
		["paintOrder", "paint-order"],
		["panose-1", "panose-1"],
		["pointerEvents", "pointer-events"],
		["renderingIntent", "rendering-intent"],
		["shapeRendering", "shape-rendering"],
		["stopColor", "stop-color"],
		["stopOpacity", "stop-opacity"],
		["strikethroughPosition", "strikethrough-position"],
		["strikethroughThickness", "strikethrough-thickness"],
		["strokeDasharray", "stroke-dasharray"],
		["strokeDashoffset", "stroke-dashoffset"],
		["strokeLinecap", "stroke-linecap"],
		["strokeLinejoin", "stroke-linejoin"],
		["strokeMiterlimit", "stroke-miterlimit"],
		["strokeOpacity", "stroke-opacity"],
		["strokeWidth", "stroke-width"],
		["textAnchor", "text-anchor"],
		["textDecoration", "text-decoration"],
		["textRendering", "text-rendering"],
		["transformOrigin", "transform-origin"],
		["underlinePosition", "underline-position"],
		["underlineThickness", "underline-thickness"],
		["unicodeBidi", "unicode-bidi"],
		["unicodeRange", "unicode-range"],
		["unitsPerEm", "units-per-em"],
		["vAlphabetic", "v-alphabetic"],
		["vHanging", "v-hanging"],
		["vIdeographic", "v-ideographic"],
		["vMathematical", "v-mathematical"],
		["vectorEffect", "vector-effect"],
		["vertAdvY", "vert-adv-y"],
		["vertOriginX", "vert-origin-x"],
		["vertOriginY", "vert-origin-y"],
		["wordSpacing", "word-spacing"],
		["writingMode", "writing-mode"],
		["xmlnsXlink", "xmlns:xlink"],
		["xHeight", "x-height"]
	]), Kt = /^[\u0000-\u001F ]*j[\r\n\t]*a[\r\n\t]*v[\r\n\t]*a[\r\n\t]*s[\r\n\t]*c[\r\n\t]*r[\r\n\t]*i[\r\n\t]*p[\r\n\t]*t[\r\n\t]*:/i;
	function qt(e) {
		return Kt.test("" + e) ? "javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')" : e;
	}
	function Jt() {}
	var Yt = null;
	function Xt(e) {
		return e = e.target || e.srcElement || window, e.correspondingUseElement && (e = e.correspondingUseElement), e.nodeType === 3 ? e.parentNode : e;
	}
	var Zt = null, Qt = null;
	function $t(e) {
		var t = dt(e);
		if (t && (e = t.stateNode)) {
			var n = e[it] || null;
			a: switch (e = t.stateNode, t.type) {
				case "input":
					if (Pt(e, n.value, n.defaultValue, n.defaultValue, n.checked, n.defaultChecked, n.type, n.name), t = n.name, n.type === "radio" && t != null) {
						for (n = e; n.parentNode;) n = n.parentNode;
						for (n = n.querySelectorAll("input[name=\"" + Nt("" + t) + "\"][type=\"radio\"]"), t = 0; t < n.length; t++) {
							var r = n[t];
							if (r !== e && r.form === e.form) {
								var a = r[it] || null;
								if (!a) throw Error(i(90));
								Pt(r, a.value, a.defaultValue, a.defaultValue, a.checked, a.defaultChecked, a.type, a.name);
							}
						}
						for (t = 0; t < n.length; t++) r = n[t], r.form === e.form && At(r);
					}
					break a;
				case "textarea":
					Rt(e, n.value, n.defaultValue);
					break a;
				case "select": t = n.value, t != null && Lt(e, !!n.multiple, t, !1);
			}
		}
	}
	var en = !1;
	function tn(e, t, n) {
		if (en) return e(t, n);
		en = !0;
		try {
			return e(t);
		} finally {
			if (en = !1, (Zt !== null || Qt !== null) && (yu(), Zt && (t = Zt, e = Qt, Qt = Zt = null, $t(t), e))) for (t = 0; t < e.length; t++) $t(e[t]);
		}
	}
	function nn(e, t) {
		var n = e.stateNode;
		if (n === null) return null;
		var r = n[it] || null;
		if (r === null) return null;
		n = r[t];
		a: switch (t) {
			case "onClick":
			case "onClickCapture":
			case "onDoubleClick":
			case "onDoubleClickCapture":
			case "onMouseDown":
			case "onMouseDownCapture":
			case "onMouseMove":
			case "onMouseMoveCapture":
			case "onMouseUp":
			case "onMouseUpCapture":
			case "onMouseEnter":
				(r = !r.disabled) || (e = e.type, r = !(e === "button" || e === "input" || e === "select" || e === "textarea")), e = !r;
				break a;
			default: e = !1;
		}
		if (e) return null;
		if (n && typeof n != "function") throw Error(i(231, t, typeof n));
		return n;
	}
	var rn = !(typeof window > "u" || window.document === void 0 || window.document.createElement === void 0), an = !1;
	if (rn) try {
		var on = {};
		Object.defineProperty(on, "passive", { get: function() {
			an = !0;
		} }), window.addEventListener("test", on, on), window.removeEventListener("test", on, on);
	} catch {
		an = !1;
	}
	var sn = null, cn = null, ln = null;
	function un() {
		if (ln) return ln;
		var e, t = cn, n = t.length, r, i = "value" in sn ? sn.value : sn.textContent, a = i.length;
		for (e = 0; e < n && t[e] === i[e]; e++);
		var o = n - e;
		for (r = 1; r <= o && t[n - r] === i[a - r]; r++);
		return ln = i.slice(e, 1 < r ? 1 - r : void 0);
	}
	function dn(e) {
		var t = e.keyCode;
		return "charCode" in e ? (e = e.charCode, e === 0 && t === 13 && (e = 13)) : e = t, e === 10 && (e = 13), 32 <= e || e === 13 ? e : 0;
	}
	function fn() {
		return !0;
	}
	function pn() {
		return !1;
	}
	function mn(e) {
		function t(t, n, r, i, a) {
			for (var o in this._reactName = t, this._targetInst = r, this.type = n, this.nativeEvent = i, this.target = a, this.currentTarget = null, e) e.hasOwnProperty(o) && (t = e[o], this[o] = t ? t(i) : i[o]);
			return this.isDefaultPrevented = (i.defaultPrevented == null ? !1 === i.returnValue : i.defaultPrevented) ? fn : pn, this.isPropagationStopped = pn, this;
		}
		return h(t.prototype, {
			preventDefault: function() {
				this.defaultPrevented = !0;
				var e = this.nativeEvent;
				e && (e.preventDefault ? e.preventDefault() : typeof e.returnValue != "unknown" && (e.returnValue = !1), this.isDefaultPrevented = fn);
			},
			stopPropagation: function() {
				var e = this.nativeEvent;
				e && (e.stopPropagation ? e.stopPropagation() : typeof e.cancelBubble != "unknown" && (e.cancelBubble = !0), this.isPropagationStopped = fn);
			},
			persist: function() {},
			isPersistent: fn
		}), t;
	}
	var hn = {
		eventPhase: 0,
		bubbles: 0,
		cancelable: 0,
		timeStamp: function(e) {
			return e.timeStamp || Date.now();
		},
		defaultPrevented: 0,
		isTrusted: 0
	}, gn = mn(hn), _n = h({}, hn, {
		view: 0,
		detail: 0
	}), vn = mn(_n), yn, bn, xn, Sn = h({}, _n, {
		screenX: 0,
		screenY: 0,
		clientX: 0,
		clientY: 0,
		pageX: 0,
		pageY: 0,
		ctrlKey: 0,
		shiftKey: 0,
		altKey: 0,
		metaKey: 0,
		getModifierState: Nn,
		button: 0,
		buttons: 0,
		relatedTarget: function(e) {
			return e.relatedTarget === void 0 ? e.fromElement === e.srcElement ? e.toElement : e.fromElement : e.relatedTarget;
		},
		movementX: function(e) {
			return "movementX" in e ? e.movementX : (e !== xn && (xn && e.type === "mousemove" ? (yn = e.screenX - xn.screenX, bn = e.screenY - xn.screenY) : bn = yn = 0, xn = e), yn);
		},
		movementY: function(e) {
			return "movementY" in e ? e.movementY : bn;
		}
	}), Cn = mn(Sn), wn = mn(h({}, Sn, { dataTransfer: 0 })), Tn = mn(h({}, _n, { relatedTarget: 0 })), En = mn(h({}, hn, {
		animationName: 0,
		elapsedTime: 0,
		pseudoElement: 0
	})), Dn = mn(h({}, hn, { clipboardData: function(e) {
		return "clipboardData" in e ? e.clipboardData : window.clipboardData;
	} })), On = mn(h({}, hn, { data: 0 })), kn = {
		Esc: "Escape",
		Spacebar: " ",
		Left: "ArrowLeft",
		Up: "ArrowUp",
		Right: "ArrowRight",
		Down: "ArrowDown",
		Del: "Delete",
		Win: "OS",
		Menu: "ContextMenu",
		Apps: "ContextMenu",
		Scroll: "ScrollLock",
		MozPrintableKey: "Unidentified"
	}, An = {
		8: "Backspace",
		9: "Tab",
		12: "Clear",
		13: "Enter",
		16: "Shift",
		17: "Control",
		18: "Alt",
		19: "Pause",
		20: "CapsLock",
		27: "Escape",
		32: " ",
		33: "PageUp",
		34: "PageDown",
		35: "End",
		36: "Home",
		37: "ArrowLeft",
		38: "ArrowUp",
		39: "ArrowRight",
		40: "ArrowDown",
		45: "Insert",
		46: "Delete",
		112: "F1",
		113: "F2",
		114: "F3",
		115: "F4",
		116: "F5",
		117: "F6",
		118: "F7",
		119: "F8",
		120: "F9",
		121: "F10",
		122: "F11",
		123: "F12",
		144: "NumLock",
		145: "ScrollLock",
		224: "Meta"
	}, jn = {
		Alt: "altKey",
		Control: "ctrlKey",
		Meta: "metaKey",
		Shift: "shiftKey"
	};
	function Mn(e) {
		var t = this.nativeEvent;
		return t.getModifierState ? t.getModifierState(e) : (e = jn[e]) ? !!t[e] : !1;
	}
	function Nn() {
		return Mn;
	}
	var Pn = mn(h({}, _n, {
		key: function(e) {
			if (e.key) {
				var t = kn[e.key] || e.key;
				if (t !== "Unidentified") return t;
			}
			return e.type === "keypress" ? (e = dn(e), e === 13 ? "Enter" : String.fromCharCode(e)) : e.type === "keydown" || e.type === "keyup" ? An[e.keyCode] || "Unidentified" : "";
		},
		code: 0,
		location: 0,
		ctrlKey: 0,
		shiftKey: 0,
		altKey: 0,
		metaKey: 0,
		repeat: 0,
		locale: 0,
		getModifierState: Nn,
		charCode: function(e) {
			return e.type === "keypress" ? dn(e) : 0;
		},
		keyCode: function(e) {
			return e.type === "keydown" || e.type === "keyup" ? e.keyCode : 0;
		},
		which: function(e) {
			return e.type === "keypress" ? dn(e) : e.type === "keydown" || e.type === "keyup" ? e.keyCode : 0;
		}
	})), Fn = mn(h({}, Sn, {
		pointerId: 0,
		width: 0,
		height: 0,
		pressure: 0,
		tangentialPressure: 0,
		tiltX: 0,
		tiltY: 0,
		twist: 0,
		pointerType: 0,
		isPrimary: 0
	})), In = mn(h({}, _n, {
		touches: 0,
		targetTouches: 0,
		changedTouches: 0,
		altKey: 0,
		metaKey: 0,
		ctrlKey: 0,
		shiftKey: 0,
		getModifierState: Nn
	})), Ln = mn(h({}, hn, {
		propertyName: 0,
		elapsedTime: 0,
		pseudoElement: 0
	})), Rn = mn(h({}, Sn, {
		deltaX: function(e) {
			return "deltaX" in e ? e.deltaX : "wheelDeltaX" in e ? -e.wheelDeltaX : 0;
		},
		deltaY: function(e) {
			return "deltaY" in e ? e.deltaY : "wheelDeltaY" in e ? -e.wheelDeltaY : "wheelDelta" in e ? -e.wheelDelta : 0;
		},
		deltaZ: 0,
		deltaMode: 0
	})), zn = mn(h({}, hn, {
		newState: 0,
		oldState: 0
	})), Bn = [
		9,
		13,
		27,
		32
	], Vn = rn && "CompositionEvent" in window, Hn = null;
	rn && "documentMode" in document && (Hn = document.documentMode);
	var Un = rn && "TextEvent" in window && !Hn, Wn = rn && (!Vn || Hn && 8 < Hn && 11 >= Hn), Gn = " ", Kn = !1;
	function qn(e, t) {
		switch (e) {
			case "keyup": return Bn.indexOf(t.keyCode) !== -1;
			case "keydown": return t.keyCode !== 229;
			case "keypress":
			case "mousedown":
			case "focusout": return !0;
			default: return !1;
		}
	}
	function Jn(e) {
		return e = e.detail, typeof e == "object" && "data" in e ? e.data : null;
	}
	var Yn = !1;
	function Xn(e, t) {
		switch (e) {
			case "compositionend": return Jn(t);
			case "keypress": return t.which === 32 ? (Kn = !0, Gn) : null;
			case "textInput": return e = t.data, e === Gn && Kn ? null : e;
			default: return null;
		}
	}
	function Zn(e, t) {
		if (Yn) return e === "compositionend" || !Vn && qn(e, t) ? (e = un(), ln = cn = sn = null, Yn = !1, e) : null;
		switch (e) {
			case "paste": return null;
			case "keypress":
				if (!(t.ctrlKey || t.altKey || t.metaKey) || t.ctrlKey && t.altKey) {
					if (t.char && 1 < t.char.length) return t.char;
					if (t.which) return String.fromCharCode(t.which);
				}
				return null;
			case "compositionend": return Wn && t.locale !== "ko" ? null : t.data;
			default: return null;
		}
	}
	var Qn = {
		color: !0,
		date: !0,
		datetime: !0,
		"datetime-local": !0,
		email: !0,
		month: !0,
		number: !0,
		password: !0,
		range: !0,
		search: !0,
		tel: !0,
		text: !0,
		time: !0,
		url: !0,
		week: !0
	};
	function $n(e) {
		var t = e && e.nodeName && e.nodeName.toLowerCase();
		return t === "input" ? !!Qn[e.type] : t === "textarea";
	}
	function er(e, t, n, r) {
		Zt ? Qt ? Qt.push(r) : Qt = [r] : Zt = r, t = Td(t, "onChange"), 0 < t.length && (n = new gn("onChange", "change", null, n, r), e.push({
			event: n,
			listeners: t
		}));
	}
	var tr = null, nr = null;
	function rr(e) {
		vd(e, 0);
	}
	function ir(e) {
		if (At(ft(e))) return e;
	}
	function ar(e, t) {
		if (e === "change") return t;
	}
	var or = !1;
	if (rn) {
		var sr;
		if (rn) {
			var cr = "oninput" in document;
			if (!cr) {
				var lr = document.createElement("div");
				lr.setAttribute("oninput", "return;"), cr = typeof lr.oninput == "function";
			}
			sr = cr;
		} else sr = !1;
		or = sr && (!document.documentMode || 9 < document.documentMode);
	}
	function ur() {
		tr && (tr.detachEvent("onpropertychange", dr), nr = tr = null);
	}
	function dr(e) {
		if (e.propertyName === "value" && ir(nr)) {
			var t = [];
			er(t, nr, e, Xt(e)), tn(rr, t);
		}
	}
	function fr(e, t, n) {
		e === "focusin" ? (ur(), tr = t, nr = n, tr.attachEvent("onpropertychange", dr)) : e === "focusout" && ur();
	}
	function pr(e) {
		if (e === "selectionchange" || e === "keyup" || e === "keydown") return ir(nr);
	}
	function mr(e, t) {
		if (e === "click") return ir(t);
	}
	function hr(e, t) {
		if (e === "input" || e === "change") return ir(t);
	}
	function gr(e, t) {
		return e === t && (e !== 0 || 1 / e == 1 / t) || e !== e && t !== t;
	}
	var _r = typeof Object.is == "function" ? Object.is : gr;
	function vr(e, t) {
		if (_r(e, t)) return !0;
		if (typeof e != "object" || !e || typeof t != "object" || !t) return !1;
		var n = Object.keys(e), r = Object.keys(t);
		if (n.length !== r.length) return !1;
		for (r = 0; r < n.length; r++) {
			var i = n[r];
			if (!be.call(t, i) || !_r(e[i], t[i])) return !1;
		}
		return !0;
	}
	function yr(e) {
		for (; e && e.firstChild;) e = e.firstChild;
		return e;
	}
	function br(e, t) {
		var n = yr(e);
		e = 0;
		for (var r; n;) {
			if (n.nodeType === 3) {
				if (r = e + n.textContent.length, e <= t && r >= t) return {
					node: n,
					offset: t - e
				};
				e = r;
			}
			a: {
				for (; n;) {
					if (n.nextSibling) {
						n = n.nextSibling;
						break a;
					}
					n = n.parentNode;
				}
				n = void 0;
			}
			n = yr(n);
		}
	}
	function xr(e, t) {
		return e && t ? e === t ? !0 : e && e.nodeType === 3 ? !1 : t && t.nodeType === 3 ? xr(e, t.parentNode) : "contains" in e ? e.contains(t) : e.compareDocumentPosition ? !!(e.compareDocumentPosition(t) & 16) : !1 : !1;
	}
	function Sr(e) {
		e = e != null && e.ownerDocument != null && e.ownerDocument.defaultView != null ? e.ownerDocument.defaultView : window;
		for (var t = jt(e.document); t instanceof e.HTMLIFrameElement;) {
			try {
				var n = typeof t.contentWindow.location.href == "string";
			} catch {
				n = !1;
			}
			if (n) e = t.contentWindow;
			else break;
			t = jt(e.document);
		}
		return t;
	}
	function Cr(e) {
		var t = e && e.nodeName && e.nodeName.toLowerCase();
		return t && (t === "input" && (e.type === "text" || e.type === "search" || e.type === "tel" || e.type === "url" || e.type === "password") || t === "textarea" || e.contentEditable === "true");
	}
	var wr = rn && "documentMode" in document && 11 >= document.documentMode, W = null, Tr = null, Er = null, Dr = !1;
	function Or(e, t, n) {
		var r = n.window === n ? n.document : n.nodeType === 9 ? n : n.ownerDocument;
		Dr || W == null || W !== jt(r) || (r = W, "selectionStart" in r && Cr(r) ? r = {
			start: r.selectionStart,
			end: r.selectionEnd
		} : (r = (r.ownerDocument && r.ownerDocument.defaultView || window).getSelection(), r = {
			anchorNode: r.anchorNode,
			anchorOffset: r.anchorOffset,
			focusNode: r.focusNode,
			focusOffset: r.focusOffset
		}), Er && vr(Er, r) || (Er = r, r = Td(Tr, "onSelect"), 0 < r.length && (t = new gn("onSelect", "select", null, t, n), e.push({
			event: t,
			listeners: r
		}), t.target = W)));
	}
	function kr(e, t) {
		var n = {};
		return n[e.toLowerCase()] = t.toLowerCase(), n["Webkit" + e] = "webkit" + t, n["Moz" + e] = "moz" + t, n;
	}
	var Ar = {
		animationend: kr("Animation", "AnimationEnd"),
		animationiteration: kr("Animation", "AnimationIteration"),
		animationstart: kr("Animation", "AnimationStart"),
		transitionrun: kr("Transition", "TransitionRun"),
		transitionstart: kr("Transition", "TransitionStart"),
		transitioncancel: kr("Transition", "TransitionCancel"),
		transitionend: kr("Transition", "TransitionEnd")
	}, G = {}, jr = {};
	rn && (jr = document.createElement("div").style, "AnimationEvent" in window || (delete Ar.animationend.animation, delete Ar.animationiteration.animation, delete Ar.animationstart.animation), "TransitionEvent" in window || delete Ar.transitionend.transition);
	function Mr(e) {
		if (G[e]) return G[e];
		if (!Ar[e]) return e;
		var t = Ar[e], n;
		for (n in t) if (t.hasOwnProperty(n) && n in jr) return G[e] = t[n];
		return e;
	}
	var Nr = Mr("animationend"), Pr = Mr("animationiteration"), Fr = Mr("animationstart"), Ir = Mr("transitionrun"), Lr = Mr("transitionstart"), Rr = Mr("transitioncancel"), zr = Mr("transitionend"), Br = /* @__PURE__ */ new Map(), Vr = "abort auxClick beforeToggle cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(" ");
	Vr.push("scrollEnd");
	function Hr(e, t) {
		Br.set(e, t), _t(t, [e]);
	}
	var Ur = typeof reportError == "function" ? reportError : function(e) {
		if (typeof window == "object" && typeof window.ErrorEvent == "function") {
			var t = new window.ErrorEvent("error", {
				bubbles: !0,
				cancelable: !0,
				message: typeof e == "object" && e && typeof e.message == "string" ? String(e.message) : String(e),
				error: e
			});
			if (!window.dispatchEvent(t)) return;
		} else if (typeof process == "object" && typeof process.emit == "function") {
			process.emit("uncaughtException", e);
			return;
		}
		console.error(e);
	}, Wr = [], Gr = 0, Kr = 0;
	function qr() {
		for (var e = Gr, t = Kr = Gr = 0; t < e;) {
			var n = Wr[t];
			Wr[t++] = null;
			var r = Wr[t];
			Wr[t++] = null;
			var i = Wr[t];
			Wr[t++] = null;
			var a = Wr[t];
			if (Wr[t++] = null, r !== null && i !== null) {
				var o = r.pending;
				o === null ? i.next = i : (i.next = o.next, o.next = i), r.pending = i;
			}
			a !== 0 && Zr(n, i, a);
		}
	}
	function Jr(e, t, n, r) {
		Wr[Gr++] = e, Wr[Gr++] = t, Wr[Gr++] = n, Wr[Gr++] = r, Kr |= r, e.lanes |= r, e = e.alternate, e !== null && (e.lanes |= r);
	}
	function Yr(e, t, n, r) {
		return Jr(e, t, n, r), Qr(e);
	}
	function Xr(e, t) {
		return Jr(e, null, null, t), Qr(e);
	}
	function Zr(e, t, n) {
		e.lanes |= n;
		var r = e.alternate;
		r !== null && (r.lanes |= n);
		for (var i = !1, a = e.return; a !== null;) a.childLanes |= n, r = a.alternate, r !== null && (r.childLanes |= n), a.tag === 22 && (e = a.stateNode, e === null || e._visibility & 1 || (i = !0)), e = a, a = a.return;
		return e.tag === 3 ? (a = e.stateNode, i && t !== null && (i = 31 - Fe(n), e = a.hiddenUpdates, r = e[i], r === null ? e[i] = [t] : r.push(t), t.lane = n | 536870912), a) : null;
	}
	function Qr(e) {
		if (50 < uu) throw uu = 0, du = null, Error(i(185));
		for (var t = e.return; t !== null;) e = t, t = e.return;
		return e.tag === 3 ? e.stateNode : null;
	}
	var $r = {};
	function ei(e, t, n, r) {
		this.tag = e, this.key = n, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.refCleanup = this.ref = null, this.pendingProps = t, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = r, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null;
	}
	function ti(e, t, n, r) {
		return new ei(e, t, n, r);
	}
	function ni(e) {
		return e = e.prototype, !(!e || !e.isReactComponent);
	}
	function ri(e, t) {
		var n = e.alternate;
		return n === null ? (n = ti(e.tag, t, e.key, e.mode), n.elementType = e.elementType, n.type = e.type, n.stateNode = e.stateNode, n.alternate = e, e.alternate = n) : (n.pendingProps = t, n.type = e.type, n.flags = 0, n.subtreeFlags = 0, n.deletions = null), n.flags = e.flags & 65011712, n.childLanes = e.childLanes, n.lanes = e.lanes, n.child = e.child, n.memoizedProps = e.memoizedProps, n.memoizedState = e.memoizedState, n.updateQueue = e.updateQueue, t = e.dependencies, n.dependencies = t === null ? null : {
			lanes: t.lanes,
			firstContext: t.firstContext
		}, n.sibling = e.sibling, n.index = e.index, n.ref = e.ref, n.refCleanup = e.refCleanup, n;
	}
	function ii(e, t) {
		e.flags &= 65011714;
		var n = e.alternate;
		return n === null ? (e.childLanes = 0, e.lanes = t, e.child = null, e.subtreeFlags = 0, e.memoizedProps = null, e.memoizedState = null, e.updateQueue = null, e.dependencies = null, e.stateNode = null) : (e.childLanes = n.childLanes, e.lanes = n.lanes, e.child = n.child, e.subtreeFlags = 0, e.deletions = null, e.memoizedProps = n.memoizedProps, e.memoizedState = n.memoizedState, e.updateQueue = n.updateQueue, e.type = n.type, t = n.dependencies, e.dependencies = t === null ? null : {
			lanes: t.lanes,
			firstContext: t.firstContext
		}), e;
	}
	function ai(e, t, n, r, a, o) {
		var s = 0;
		if (r = e, typeof e == "function") ni(e) && (s = 1);
		else if (typeof e == "string") s = Uf(e, n, ae.current) ? 26 : e === "html" || e === "head" || e === "body" ? 27 : 5;
		else a: switch (e) {
			case k: return e = ti(31, n, t, a), e.elementType = k, e.lanes = o, e;
			case y: return oi(n.children, a, o, t);
			case b:
				s = 8, a |= 24;
				break;
			case x: return e = ti(12, n, t, a | 2), e.elementType = x, e.lanes = o, e;
			case T: return e = ti(13, n, t, a), e.elementType = T, e.lanes = o, e;
			case E: return e = ti(19, n, t, a), e.elementType = E, e.lanes = o, e;
			default:
				if (typeof e == "object" && e) switch (e.$$typeof) {
					case C:
						s = 10;
						break a;
					case S:
						s = 9;
						break a;
					case w:
						s = 11;
						break a;
					case D:
						s = 14;
						break a;
					case O:
						s = 16, r = null;
						break a;
				}
				s = 29, n = Error(i(130, e === null ? "null" : typeof e, "")), r = null;
		}
		return t = ti(s, n, t, a), t.elementType = e, t.type = r, t.lanes = o, t;
	}
	function oi(e, t, n, r) {
		return e = ti(7, e, r, t), e.lanes = n, e;
	}
	function si(e, t, n) {
		return e = ti(6, e, null, t), e.lanes = n, e;
	}
	function ci(e) {
		var t = ti(18, null, null, 0);
		return t.stateNode = e, t;
	}
	function li(e, t, n) {
		return t = ti(4, e.children === null ? [] : e.children, e.key, t), t.lanes = n, t.stateNode = {
			containerInfo: e.containerInfo,
			pendingChildren: null,
			implementation: e.implementation
		}, t;
	}
	var ui = /* @__PURE__ */ new WeakMap();
	function di(e, t) {
		if (typeof e == "object" && e) {
			var n = ui.get(e);
			return n === void 0 ? (t = {
				value: e,
				source: t,
				stack: ye(t)
			}, ui.set(e, t), t) : n;
		}
		return {
			value: e,
			source: t,
			stack: ye(t)
		};
	}
	var fi = [], pi = 0, mi = null, hi = 0, gi = [], _i = 0, vi = null, yi = 1, bi = "";
	function xi(e, t) {
		fi[pi++] = hi, fi[pi++] = mi, mi = e, hi = t;
	}
	function Si(e, t, n) {
		gi[_i++] = yi, gi[_i++] = bi, gi[_i++] = vi, vi = e;
		var r = yi;
		e = bi;
		var i = 32 - Fe(r) - 1;
		r &= ~(1 << i), n += 1;
		var a = 32 - Fe(t) + i;
		if (30 < a) {
			var o = i - i % 5;
			a = (r & (1 << o) - 1).toString(32), r >>= o, i -= o, yi = 1 << 32 - Fe(t) + i | n << i | r, bi = a + e;
		} else yi = 1 << a | n << i | r, bi = e;
	}
	function Ci(e) {
		e.return !== null && (xi(e, 1), Si(e, 1, 0));
	}
	function wi(e) {
		for (; e === mi;) mi = fi[--pi], fi[pi] = null, hi = fi[--pi], fi[pi] = null;
		for (; e === vi;) vi = gi[--_i], gi[_i] = null, bi = gi[--_i], gi[_i] = null, yi = gi[--_i], gi[_i] = null;
	}
	function Ti(e, t) {
		gi[_i++] = yi, gi[_i++] = bi, gi[_i++] = vi, yi = t.id, bi = t.overflow, vi = e;
	}
	var Ei = null, Di = null, K = !1, Oi = null, ki = !1, Ai = Error(i(519));
	function ji(e) {
		throw Li(di(Error(i(418, 1 < arguments.length && arguments[1] !== void 0 && arguments[1] ? "text" : "HTML", "")), e)), Ai;
	}
	function Mi(e) {
		var t = e.stateNode, n = e.type, r = e.memoizedProps;
		switch (t[rt] = e, t[it] = r, n) {
			case "dialog":
				$("cancel", t), $("close", t);
				break;
			case "iframe":
			case "object":
			case "embed":
				$("load", t);
				break;
			case "video":
			case "audio":
				for (n = 0; n < gd.length; n++) $(gd[n], t);
				break;
			case "source":
				$("error", t);
				break;
			case "img":
			case "image":
			case "link":
				$("error", t), $("load", t);
				break;
			case "details":
				$("toggle", t);
				break;
			case "input":
				$("invalid", t), Ft(t, r.value, r.defaultValue, r.checked, r.defaultChecked, r.type, r.name, !0);
				break;
			case "select":
				$("invalid", t);
				break;
			case "textarea": $("invalid", t), zt(t, r.value, r.defaultValue, r.children);
		}
		n = r.children, typeof n != "string" && typeof n != "number" && typeof n != "bigint" || t.textContent === "" + n || !0 === r.suppressHydrationWarning || jd(t.textContent, n) ? (r.popover != null && ($("beforetoggle", t), $("toggle", t)), r.onScroll != null && $("scroll", t), r.onScrollEnd != null && $("scrollend", t), r.onClick != null && (t.onclick = Jt), t = !0) : t = !1, t || ji(e, !0);
	}
	function Ni(e) {
		for (Ei = e.return; Ei;) switch (Ei.tag) {
			case 5:
			case 31:
			case 13:
				ki = !1;
				return;
			case 27:
			case 3:
				ki = !0;
				return;
			default: Ei = Ei.return;
		}
	}
	function Pi(e) {
		if (e !== Ei) return !1;
		if (!K) return Ni(e), K = !0, !1;
		var t = e.tag, n;
		if ((n = t !== 3 && t !== 27) && ((n = t === 5) && (n = e.type, n = !(n !== "form" && n !== "button") || Ud(e.type, e.memoizedProps)), n = !n), n && Di && ji(e), Ni(e), t === 13) {
			if (e = e.memoizedState, e = e === null ? null : e.dehydrated, !e) throw Error(i(317));
			Di = uf(e);
		} else if (t === 31) {
			if (e = e.memoizedState, e = e === null ? null : e.dehydrated, !e) throw Error(i(317));
			Di = uf(e);
		} else t === 27 ? (t = Di, Zd(e.type) ? (e = lf, lf = null, Di = e) : Di = t) : Di = Ei ? cf(e.stateNode.nextSibling) : null;
		return !0;
	}
	function Fi() {
		Di = Ei = null, K = !1;
	}
	function Ii() {
		var e = Oi;
		return e !== null && (Xl === null ? Xl = e : Xl.push.apply(Xl, e), Oi = null), e;
	}
	function Li(e) {
		Oi === null ? Oi = [e] : Oi.push(e);
	}
	var Ri = re(null), zi = null, Bi = null;
	function Vi(e, t, n) {
		R(Ri, t._currentValue), t._currentValue = n;
	}
	function Hi(e) {
		e._currentValue = Ri.current, ie(Ri);
	}
	function Ui(e, t, n) {
		for (; e !== null;) {
			var r = e.alternate;
			if ((e.childLanes & t) === t ? r !== null && (r.childLanes & t) !== t && (r.childLanes |= t) : (e.childLanes |= t, r !== null && (r.childLanes |= t)), e === n) break;
			e = e.return;
		}
	}
	function Wi(e, t, n, r) {
		var a = e.child;
		for (a !== null && (a.return = e); a !== null;) {
			var o = a.dependencies;
			if (o !== null) {
				var s = a.child;
				o = o.firstContext;
				a: for (; o !== null;) {
					var c = o;
					o = a;
					for (var l = 0; l < t.length; l++) if (c.context === t[l]) {
						o.lanes |= n, c = o.alternate, c !== null && (c.lanes |= n), Ui(o.return, n, e), r || (s = null);
						break a;
					}
					o = c.next;
				}
			} else if (a.tag === 18) {
				if (s = a.return, s === null) throw Error(i(341));
				s.lanes |= n, o = s.alternate, o !== null && (o.lanes |= n), Ui(s, n, e), s = null;
			} else s = a.child;
			if (s !== null) s.return = a;
			else for (s = a; s !== null;) {
				if (s === e) {
					s = null;
					break;
				}
				if (a = s.sibling, a !== null) {
					a.return = s.return, s = a;
					break;
				}
				s = s.return;
			}
			a = s;
		}
	}
	function Gi(e, t, n, r) {
		e = null;
		for (var a = t, o = !1; a !== null;) {
			if (!o) {
				if (a.flags & 524288) o = !0;
				else if (a.flags & 262144) break;
			}
			if (a.tag === 10) {
				var s = a.alternate;
				if (s === null) throw Error(i(387));
				if (s = s.memoizedProps, s !== null) {
					var c = a.type;
					_r(a.pendingProps.value, s.value) || (e === null ? e = [c] : e.push(c));
				}
			} else if (a === ce.current) {
				if (s = a.alternate, s === null) throw Error(i(387));
				s.memoizedState.memoizedState !== a.memoizedState.memoizedState && (e === null ? e = [Qf] : e.push(Qf));
			}
			a = a.return;
		}
		e !== null && Wi(t, e, n, r), t.flags |= 262144;
	}
	function Ki(e) {
		for (e = e.firstContext; e !== null;) {
			if (!_r(e.context._currentValue, e.memoizedValue)) return !0;
			e = e.next;
		}
		return !1;
	}
	function qi(e) {
		zi = e, Bi = null, e = e.dependencies, e !== null && (e.firstContext = null);
	}
	function Ji(e) {
		return Xi(zi, e);
	}
	function Yi(e, t) {
		return zi === null && qi(e), Xi(e, t);
	}
	function Xi(e, t) {
		var n = t._currentValue;
		if (t = {
			context: t,
			memoizedValue: n,
			next: null
		}, Bi === null) {
			if (e === null) throw Error(i(308));
			Bi = t, e.dependencies = {
				lanes: 0,
				firstContext: t
			}, e.flags |= 524288;
		} else Bi = Bi.next = t;
		return n;
	}
	var Zi = typeof AbortController < "u" ? AbortController : function() {
		var e = [], t = this.signal = {
			aborted: !1,
			addEventListener: function(t, n) {
				e.push(n);
			}
		};
		this.abort = function() {
			t.aborted = !0, e.forEach(function(e) {
				return e();
			});
		};
	}, Qi = t.unstable_scheduleCallback, $i = t.unstable_NormalPriority, ea = {
		$$typeof: C,
		Consumer: null,
		Provider: null,
		_currentValue: null,
		_currentValue2: null,
		_threadCount: 0
	};
	function ta() {
		return {
			controller: new Zi(),
			data: /* @__PURE__ */ new Map(),
			refCount: 0
		};
	}
	function na(e) {
		e.refCount--, e.refCount === 0 && Qi($i, function() {
			e.controller.abort();
		});
	}
	var ra = null, ia = 0, aa = 0, oa = null;
	function sa(e, t) {
		if (ra === null) {
			var n = ra = [];
			ia = 0, aa = ud(), oa = {
				status: "pending",
				value: void 0,
				then: function(e) {
					n.push(e);
				}
			};
		}
		return ia++, t.then(ca, ca), t;
	}
	function ca() {
		if (--ia === 0 && ra !== null) {
			oa !== null && (oa.status = "fulfilled");
			var e = ra;
			ra = null, aa = 0, oa = null;
			for (var t = 0; t < e.length; t++) (0, e[t])();
		}
	}
	function la(e, t) {
		var n = [], r = {
			status: "pending",
			value: null,
			reason: null,
			then: function(e) {
				n.push(e);
			}
		};
		return e.then(function() {
			r.status = "fulfilled", r.value = t;
			for (var e = 0; e < n.length; e++) (0, n[e])(t);
		}, function(e) {
			for (r.status = "rejected", r.reason = e, e = 0; e < n.length; e++) (0, n[e])(void 0);
		}), r;
	}
	var ua = F.S;
	F.S = function(e, t) {
		$l = z(), typeof t == "object" && t && typeof t.then == "function" && sa(e, t), ua !== null && ua(e, t);
	};
	var da = re(null);
	function fa() {
		var e = da.current;
		return e === null ? Ll.pooledCache : e;
	}
	function pa(e, t) {
		t === null ? R(da, da.current) : R(da, t.pool);
	}
	function ma() {
		var e = fa();
		return e === null ? null : {
			parent: ea._currentValue,
			pool: e
		};
	}
	var ha = Error(i(460)), ga = Error(i(474)), _a = Error(i(542)), va = { then: function() {} };
	function ya(e) {
		return e = e.status, e === "fulfilled" || e === "rejected";
	}
	function ba(e, t, n) {
		switch (n = e[n], n === void 0 ? e.push(t) : n !== t && (t.then(Jt, Jt), t = n), t.status) {
			case "fulfilled": return t.value;
			case "rejected": throw e = t.reason, wa(e), e;
			default:
				if (typeof t.status == "string") t.then(Jt, Jt);
				else {
					if (e = Ll, e !== null && 100 < e.shellSuspendCounter) throw Error(i(482));
					e = t, e.status = "pending", e.then(function(e) {
						if (t.status === "pending") {
							var n = t;
							n.status = "fulfilled", n.value = e;
						}
					}, function(e) {
						if (t.status === "pending") {
							var n = t;
							n.status = "rejected", n.reason = e;
						}
					});
				}
				switch (t.status) {
					case "fulfilled": return t.value;
					case "rejected": throw e = t.reason, wa(e), e;
				}
				throw Sa = t, ha;
		}
	}
	function xa(e) {
		try {
			var t = e._init;
			return t(e._payload);
		} catch (e) {
			throw typeof e == "object" && e && typeof e.then == "function" ? (Sa = e, ha) : e;
		}
	}
	var Sa = null;
	function Ca() {
		if (Sa === null) throw Error(i(459));
		var e = Sa;
		return Sa = null, e;
	}
	function wa(e) {
		if (e === ha || e === _a) throw Error(i(483));
	}
	var Ta = null, Ea = 0;
	function Da(e) {
		var t = Ea;
		return Ea += 1, Ta === null && (Ta = []), ba(Ta, e, t);
	}
	function Oa(e, t) {
		t = t.props.ref, e.ref = t === void 0 ? null : t;
	}
	function ka(e, t) {
		throw t.$$typeof === g ? Error(i(525)) : (e = Object.prototype.toString.call(t), Error(i(31, e === "[object Object]" ? "object with keys {" + Object.keys(t).join(", ") + "}" : e)));
	}
	function Aa(e) {
		function t(t, n) {
			if (e) {
				var r = t.deletions;
				r === null ? (t.deletions = [n], t.flags |= 16) : r.push(n);
			}
		}
		function n(n, r) {
			if (!e) return null;
			for (; r !== null;) t(n, r), r = r.sibling;
			return null;
		}
		function r(e) {
			for (var t = /* @__PURE__ */ new Map(); e !== null;) e.key === null ? t.set(e.index, e) : t.set(e.key, e), e = e.sibling;
			return t;
		}
		function a(e, t) {
			return e = ri(e, t), e.index = 0, e.sibling = null, e;
		}
		function o(t, n, r) {
			return t.index = r, e ? (r = t.alternate, r === null ? (t.flags |= 67108866, n) : (r = r.index, r < n ? (t.flags |= 67108866, n) : r)) : (t.flags |= 1048576, n);
		}
		function s(t) {
			return e && t.alternate === null && (t.flags |= 67108866), t;
		}
		function c(e, t, n, r) {
			return t === null || t.tag !== 6 ? (t = si(n, e.mode, r), t.return = e, t) : (t = a(t, n), t.return = e, t);
		}
		function l(e, t, n, r) {
			var i = n.type;
			return i === y ? d(e, t, n.props.children, r, n.key) : t !== null && (t.elementType === i || typeof i == "object" && i && i.$$typeof === O && xa(i) === t.type) ? (t = a(t, n.props), Oa(t, n), t.return = e, t) : (t = ai(n.type, n.key, n.props, null, e.mode, r), Oa(t, n), t.return = e, t);
		}
		function u(e, t, n, r) {
			return t === null || t.tag !== 4 || t.stateNode.containerInfo !== n.containerInfo || t.stateNode.implementation !== n.implementation ? (t = li(n, e.mode, r), t.return = e, t) : (t = a(t, n.children || []), t.return = e, t);
		}
		function d(e, t, n, r, i) {
			return t === null || t.tag !== 7 ? (t = oi(n, e.mode, r, i), t.return = e, t) : (t = a(t, n), t.return = e, t);
		}
		function f(e, t, n) {
			if (typeof t == "string" && t !== "" || typeof t == "number" || typeof t == "bigint") return t = si("" + t, e.mode, n), t.return = e, t;
			if (typeof t == "object" && t) {
				switch (t.$$typeof) {
					case _: return n = ai(t.type, t.key, t.props, null, e.mode, n), Oa(n, t), n.return = e, n;
					case v: return t = li(t, e.mode, n), t.return = e, t;
					case O: return t = xa(t), f(e, t, n);
				}
				if (P(t) || M(t)) return t = oi(t, e.mode, n, null), t.return = e, t;
				if (typeof t.then == "function") return f(e, Da(t), n);
				if (t.$$typeof === C) return f(e, Yi(e, t), n);
				ka(e, t);
			}
			return null;
		}
		function p(e, t, n, r) {
			var i = t === null ? null : t.key;
			if (typeof n == "string" && n !== "" || typeof n == "number" || typeof n == "bigint") return i === null ? c(e, t, "" + n, r) : null;
			if (typeof n == "object" && n) {
				switch (n.$$typeof) {
					case _: return n.key === i ? l(e, t, n, r) : null;
					case v: return n.key === i ? u(e, t, n, r) : null;
					case O: return n = xa(n), p(e, t, n, r);
				}
				if (P(n) || M(n)) return i === null ? d(e, t, n, r, null) : null;
				if (typeof n.then == "function") return p(e, t, Da(n), r);
				if (n.$$typeof === C) return p(e, t, Yi(e, n), r);
				ka(e, n);
			}
			return null;
		}
		function m(e, t, n, r, i) {
			if (typeof r == "string" && r !== "" || typeof r == "number" || typeof r == "bigint") return e = e.get(n) || null, c(t, e, "" + r, i);
			if (typeof r == "object" && r) {
				switch (r.$$typeof) {
					case _: return e = e.get(r.key === null ? n : r.key) || null, l(t, e, r, i);
					case v: return e = e.get(r.key === null ? n : r.key) || null, u(t, e, r, i);
					case O: return r = xa(r), m(e, t, n, r, i);
				}
				if (P(r) || M(r)) return e = e.get(n) || null, d(t, e, r, i, null);
				if (typeof r.then == "function") return m(e, t, n, Da(r), i);
				if (r.$$typeof === C) return m(e, t, n, Yi(t, r), i);
				ka(t, r);
			}
			return null;
		}
		function h(i, a, s, c) {
			for (var l = null, u = null, d = a, h = a = 0, g = null; d !== null && h < s.length; h++) {
				d.index > h ? (g = d, d = null) : g = d.sibling;
				var _ = p(i, d, s[h], c);
				if (_ === null) {
					d === null && (d = g);
					break;
				}
				e && d && _.alternate === null && t(i, d), a = o(_, a, h), u === null ? l = _ : u.sibling = _, u = _, d = g;
			}
			if (h === s.length) return n(i, d), K && xi(i, h), l;
			if (d === null) {
				for (; h < s.length; h++) d = f(i, s[h], c), d !== null && (a = o(d, a, h), u === null ? l = d : u.sibling = d, u = d);
				return K && xi(i, h), l;
			}
			for (d = r(d); h < s.length; h++) g = m(d, i, h, s[h], c), g !== null && (e && g.alternate !== null && d.delete(g.key === null ? h : g.key), a = o(g, a, h), u === null ? l = g : u.sibling = g, u = g);
			return e && d.forEach(function(e) {
				return t(i, e);
			}), K && xi(i, h), l;
		}
		function g(a, s, c, l) {
			if (c == null) throw Error(i(151));
			for (var u = null, d = null, h = s, g = s = 0, _ = null, v = c.next(); h !== null && !v.done; g++, v = c.next()) {
				h.index > g ? (_ = h, h = null) : _ = h.sibling;
				var y = p(a, h, v.value, l);
				if (y === null) {
					h === null && (h = _);
					break;
				}
				e && h && y.alternate === null && t(a, h), s = o(y, s, g), d === null ? u = y : d.sibling = y, d = y, h = _;
			}
			if (v.done) return n(a, h), K && xi(a, g), u;
			if (h === null) {
				for (; !v.done; g++, v = c.next()) v = f(a, v.value, l), v !== null && (s = o(v, s, g), d === null ? u = v : d.sibling = v, d = v);
				return K && xi(a, g), u;
			}
			for (h = r(h); !v.done; g++, v = c.next()) v = m(h, a, g, v.value, l), v !== null && (e && v.alternate !== null && h.delete(v.key === null ? g : v.key), s = o(v, s, g), d === null ? u = v : d.sibling = v, d = v);
			return e && h.forEach(function(e) {
				return t(a, e);
			}), K && xi(a, g), u;
		}
		function b(e, r, o, c) {
			if (typeof o == "object" && o && o.type === y && o.key === null && (o = o.props.children), typeof o == "object" && o) {
				switch (o.$$typeof) {
					case _:
						a: {
							for (var l = o.key; r !== null;) {
								if (r.key === l) {
									if (l = o.type, l === y) {
										if (r.tag === 7) {
											n(e, r.sibling), c = a(r, o.props.children), c.return = e, e = c;
											break a;
										}
									} else if (r.elementType === l || typeof l == "object" && l && l.$$typeof === O && xa(l) === r.type) {
										n(e, r.sibling), c = a(r, o.props), Oa(c, o), c.return = e, e = c;
										break a;
									}
									n(e, r);
									break;
								} else t(e, r);
								r = r.sibling;
							}
							o.type === y ? (c = oi(o.props.children, e.mode, c, o.key), c.return = e, e = c) : (c = ai(o.type, o.key, o.props, null, e.mode, c), Oa(c, o), c.return = e, e = c);
						}
						return s(e);
					case v:
						a: {
							for (l = o.key; r !== null;) {
								if (r.key === l) if (r.tag === 4 && r.stateNode.containerInfo === o.containerInfo && r.stateNode.implementation === o.implementation) {
									n(e, r.sibling), c = a(r, o.children || []), c.return = e, e = c;
									break a;
								} else {
									n(e, r);
									break;
								}
								else t(e, r);
								r = r.sibling;
							}
							c = li(o, e.mode, c), c.return = e, e = c;
						}
						return s(e);
					case O: return o = xa(o), b(e, r, o, c);
				}
				if (P(o)) return h(e, r, o, c);
				if (M(o)) {
					if (l = M(o), typeof l != "function") throw Error(i(150));
					return o = l.call(o), g(e, r, o, c);
				}
				if (typeof o.then == "function") return b(e, r, Da(o), c);
				if (o.$$typeof === C) return b(e, r, Yi(e, o), c);
				ka(e, o);
			}
			return typeof o == "string" && o !== "" || typeof o == "number" || typeof o == "bigint" ? (o = "" + o, r !== null && r.tag === 6 ? (n(e, r.sibling), c = a(r, o), c.return = e, e = c) : (n(e, r), c = si(o, e.mode, c), c.return = e, e = c), s(e)) : n(e, r);
		}
		return function(e, t, n, r) {
			try {
				Ea = 0;
				var i = b(e, t, n, r);
				return Ta = null, i;
			} catch (t) {
				if (t === ha || t === _a) throw t;
				var a = ti(29, t, null, e.mode);
				return a.lanes = r, a.return = e, a;
			}
		};
	}
	var ja = Aa(!0), Ma = Aa(!1), Na = !1;
	function Pa(e) {
		e.updateQueue = {
			baseState: e.memoizedState,
			firstBaseUpdate: null,
			lastBaseUpdate: null,
			shared: {
				pending: null,
				lanes: 0,
				hiddenCallbacks: null
			},
			callbacks: null
		};
	}
	function Fa(e, t) {
		e = e.updateQueue, t.updateQueue === e && (t.updateQueue = {
			baseState: e.baseState,
			firstBaseUpdate: e.firstBaseUpdate,
			lastBaseUpdate: e.lastBaseUpdate,
			shared: e.shared,
			callbacks: null
		});
	}
	function Ia(e) {
		return {
			lane: e,
			tag: 0,
			payload: null,
			callback: null,
			next: null
		};
	}
	function La(e, t, n) {
		var r = e.updateQueue;
		if (r === null) return null;
		if (r = r.shared, J & 2) {
			var i = r.pending;
			return i === null ? t.next = t : (t.next = i.next, i.next = t), r.pending = t, t = Qr(e), Zr(e, null, n), t;
		}
		return Jr(e, r, t, n), Qr(e);
	}
	function Ra(e, t, n) {
		if (t = t.updateQueue, t !== null && (t = t.shared, n & 4194048)) {
			var r = t.lanes;
			r &= e.pendingLanes, n |= r, t.lanes = n, Xe(e, n);
		}
	}
	function za(e, t) {
		var n = e.updateQueue, r = e.alternate;
		if (r !== null && (r = r.updateQueue, n === r)) {
			var i = null, a = null;
			if (n = n.firstBaseUpdate, n !== null) {
				do {
					var o = {
						lane: n.lane,
						tag: n.tag,
						payload: n.payload,
						callback: null,
						next: null
					};
					a === null ? i = a = o : a = a.next = o, n = n.next;
				} while (n !== null);
				a === null ? i = a = t : a = a.next = t;
			} else i = a = t;
			n = {
				baseState: r.baseState,
				firstBaseUpdate: i,
				lastBaseUpdate: a,
				shared: r.shared,
				callbacks: r.callbacks
			}, e.updateQueue = n;
			return;
		}
		e = n.lastBaseUpdate, e === null ? n.firstBaseUpdate = t : e.next = t, n.lastBaseUpdate = t;
	}
	var Ba = !1;
	function Va() {
		if (Ba) {
			var e = oa;
			if (e !== null) throw e;
		}
	}
	function Ha(e, t, n, r) {
		Ba = !1;
		var i = e.updateQueue;
		Na = !1;
		var a = i.firstBaseUpdate, o = i.lastBaseUpdate, s = i.shared.pending;
		if (s !== null) {
			i.shared.pending = null;
			var c = s, l = c.next;
			c.next = null, o === null ? a = l : o.next = l, o = c;
			var u = e.alternate;
			u !== null && (u = u.updateQueue, s = u.lastBaseUpdate, s !== o && (s === null ? u.firstBaseUpdate = l : s.next = l, u.lastBaseUpdate = c));
		}
		if (a !== null) {
			var d = i.baseState;
			o = 0, u = l = c = null, s = a;
			do {
				var f = s.lane & -536870913, p = f !== s.lane;
				if (p ? (X & f) === f : (r & f) === f) {
					f !== 0 && f === aa && (Ba = !0), u !== null && (u = u.next = {
						lane: 0,
						tag: s.tag,
						payload: s.payload,
						callback: null,
						next: null
					});
					a: {
						var m = e, g = s;
						f = t;
						var _ = n;
						switch (g.tag) {
							case 1:
								if (m = g.payload, typeof m == "function") {
									d = m.call(_, d, f);
									break a;
								}
								d = m;
								break a;
							case 3: m.flags = m.flags & -65537 | 128;
							case 0:
								if (m = g.payload, f = typeof m == "function" ? m.call(_, d, f) : m, f == null) break a;
								d = h({}, d, f);
								break a;
							case 2: Na = !0;
						}
					}
					f = s.callback, f !== null && (e.flags |= 64, p && (e.flags |= 8192), p = i.callbacks, p === null ? i.callbacks = [f] : p.push(f));
				} else p = {
					lane: f,
					tag: s.tag,
					payload: s.payload,
					callback: s.callback,
					next: null
				}, u === null ? (l = u = p, c = d) : u = u.next = p, o |= f;
				if (s = s.next, s === null) {
					if (s = i.shared.pending, s === null) break;
					p = s, s = p.next, p.next = null, i.lastBaseUpdate = p, i.shared.pending = null;
				}
			} while (1);
			u === null && (c = d), i.baseState = c, i.firstBaseUpdate = l, i.lastBaseUpdate = u, a === null && (i.shared.lanes = 0), Wl |= o, e.lanes = o, e.memoizedState = d;
		}
	}
	function Ua(e, t) {
		if (typeof e != "function") throw Error(i(191, e));
		e.call(t);
	}
	function Wa(e, t) {
		var n = e.callbacks;
		if (n !== null) for (e.callbacks = null, e = 0; e < n.length; e++) Ua(n[e], t);
	}
	var Ga = re(null), Ka = re(0);
	function qa(e, t) {
		e = Hl, R(Ka, e), R(Ga, t), Hl = e | t.baseLanes;
	}
	function Ja() {
		R(Ka, Hl), R(Ga, Ga.current);
	}
	function Ya() {
		Hl = Ka.current, ie(Ga), ie(Ka);
	}
	var Xa = re(null), Za = null;
	function Qa(e) {
		var t = e.alternate;
		R(ro, ro.current & 1), R(Xa, e), Za === null && (t === null || Ga.current !== null || t.memoizedState !== null) && (Za = e);
	}
	function $a(e) {
		R(ro, ro.current), R(Xa, e), Za === null && (Za = e);
	}
	function eo(e) {
		e.tag === 22 ? (R(ro, ro.current), R(Xa, e), Za === null && (Za = e)) : to(e);
	}
	function to() {
		R(ro, ro.current), R(Xa, Xa.current);
	}
	function no(e) {
		ie(Xa), Za === e && (Za = null), ie(ro);
	}
	var ro = re(0);
	function io(e) {
		for (var t = e; t !== null;) {
			if (t.tag === 13) {
				var n = t.memoizedState;
				if (n !== null && (n = n.dehydrated, n === null || af(n) || of(n))) return t;
			} else if (t.tag === 19 && (t.memoizedProps.revealOrder === "forwards" || t.memoizedProps.revealOrder === "backwards" || t.memoizedProps.revealOrder === "unstable_legacy-backwards" || t.memoizedProps.revealOrder === "together")) {
				if (t.flags & 128) return t;
			} else if (t.child !== null) {
				t.child.return = t, t = t.child;
				continue;
			}
			if (t === e) break;
			for (; t.sibling === null;) {
				if (t.return === null || t.return === e) return null;
				t = t.return;
			}
			t.sibling.return = t.return, t = t.sibling;
		}
		return null;
	}
	var ao = 0, q = null, oo = null, so = null, co = !1, lo = !1, uo = !1, fo = 0, po = 0, mo = null, ho = 0;
	function go() {
		throw Error(i(321));
	}
	function _o(e, t) {
		if (t === null) return !1;
		for (var n = 0; n < t.length && n < e.length; n++) if (!_r(e[n], t[n])) return !1;
		return !0;
	}
	function vo(e, t, n, r, i, a) {
		return ao = a, q = t, t.memoizedState = null, t.updateQueue = null, t.lanes = 0, F.H = e === null || e.memoizedState === null ? Fs : Is, uo = !1, a = n(r, i), uo = !1, lo && (a = bo(t, n, r, i)), yo(e), a;
	}
	function yo(e) {
		F.H = Ps;
		var t = oo !== null && oo.next !== null;
		if (ao = 0, so = oo = q = null, co = !1, po = 0, mo = null, t) throw Error(i(300));
		e === null || $s || (e = e.dependencies, e !== null && Ki(e) && ($s = !0));
	}
	function bo(e, t, n, r) {
		q = e;
		var a = 0;
		do {
			if (lo && (mo = null), po = 0, lo = !1, 25 <= a) throw Error(i(301));
			if (a += 1, so = oo = null, e.updateQueue != null) {
				var o = e.updateQueue;
				o.lastEffect = null, o.events = null, o.stores = null, o.memoCache != null && (o.memoCache.index = 0);
			}
			F.H = Ls, o = t(n, r);
		} while (lo);
		return o;
	}
	function xo() {
		var e = F.H, t = e.useState()[0];
		return t = typeof t.then == "function" ? Oo(t) : t, e = e.useState()[0], (oo === null ? null : oo.memoizedState) !== e && (q.flags |= 1024), t;
	}
	function So() {
		var e = fo !== 0;
		return fo = 0, e;
	}
	function Co(e, t, n) {
		t.updateQueue = e.updateQueue, t.flags &= -2053, e.lanes &= ~n;
	}
	function wo(e) {
		if (co) {
			for (e = e.memoizedState; e !== null;) {
				var t = e.queue;
				t !== null && (t.pending = null), e = e.next;
			}
			co = !1;
		}
		ao = 0, so = oo = q = null, lo = !1, po = fo = 0, mo = null;
	}
	function To() {
		var e = {
			memoizedState: null,
			baseState: null,
			baseQueue: null,
			queue: null,
			next: null
		};
		return so === null ? q.memoizedState = so = e : so = so.next = e, so;
	}
	function Eo() {
		if (oo === null) {
			var e = q.alternate;
			e = e === null ? null : e.memoizedState;
		} else e = oo.next;
		var t = so === null ? q.memoizedState : so.next;
		if (t !== null) so = t, oo = e;
		else {
			if (e === null) throw q.alternate === null ? Error(i(467)) : Error(i(310));
			oo = e, e = {
				memoizedState: oo.memoizedState,
				baseState: oo.baseState,
				baseQueue: oo.baseQueue,
				queue: oo.queue,
				next: null
			}, so === null ? q.memoizedState = so = e : so = so.next = e;
		}
		return so;
	}
	function Do() {
		return {
			lastEffect: null,
			events: null,
			stores: null,
			memoCache: null
		};
	}
	function Oo(e) {
		var t = po;
		return po += 1, mo === null && (mo = []), e = ba(mo, e, t), t = q, (so === null ? t.memoizedState : so.next) === null && (t = t.alternate, F.H = t === null || t.memoizedState === null ? Fs : Is), e;
	}
	function ko(e) {
		if (typeof e == "object" && e) {
			if (typeof e.then == "function") return Oo(e);
			if (e.$$typeof === C) return Ji(e);
		}
		throw Error(i(438, String(e)));
	}
	function Ao(e) {
		var t = null, n = q.updateQueue;
		if (n !== null && (t = n.memoCache), t == null) {
			var r = q.alternate;
			r !== null && (r = r.updateQueue, r !== null && (r = r.memoCache, r != null && (t = {
				data: r.data.map(function(e) {
					return e.slice();
				}),
				index: 0
			})));
		}
		if (t ??= {
			data: [],
			index: 0
		}, n === null && (n = Do(), q.updateQueue = n), n.memoCache = t, n = t.data[t.index], n === void 0) for (n = t.data[t.index] = Array(e), r = 0; r < e; r++) n[r] = A;
		return t.index++, n;
	}
	function jo(e, t) {
		return typeof t == "function" ? t(e) : t;
	}
	function Mo(e) {
		return No(Eo(), oo, e);
	}
	function No(e, t, n) {
		var r = e.queue;
		if (r === null) throw Error(i(311));
		r.lastRenderedReducer = n;
		var a = e.baseQueue, o = r.pending;
		if (o !== null) {
			if (a !== null) {
				var s = a.next;
				a.next = o.next, o.next = s;
			}
			t.baseQueue = a = o, r.pending = null;
		}
		if (o = e.baseState, a === null) e.memoizedState = o;
		else {
			t = a.next;
			var c = s = null, l = null, u = t, d = !1;
			do {
				var f = u.lane & -536870913;
				if (f === u.lane ? (ao & f) === f : (X & f) === f) {
					var p = u.revertLane;
					if (p === 0) l !== null && (l = l.next = {
						lane: 0,
						revertLane: 0,
						gesture: null,
						action: u.action,
						hasEagerState: u.hasEagerState,
						eagerState: u.eagerState,
						next: null
					}), f === aa && (d = !0);
					else if ((ao & p) === p) {
						u = u.next, p === aa && (d = !0);
						continue;
					} else f = {
						lane: 0,
						revertLane: u.revertLane,
						gesture: null,
						action: u.action,
						hasEagerState: u.hasEagerState,
						eagerState: u.eagerState,
						next: null
					}, l === null ? (c = l = f, s = o) : l = l.next = f, q.lanes |= p, Wl |= p;
					f = u.action, uo && n(o, f), o = u.hasEagerState ? u.eagerState : n(o, f);
				} else p = {
					lane: f,
					revertLane: u.revertLane,
					gesture: u.gesture,
					action: u.action,
					hasEagerState: u.hasEagerState,
					eagerState: u.eagerState,
					next: null
				}, l === null ? (c = l = p, s = o) : l = l.next = p, q.lanes |= f, Wl |= f;
				u = u.next;
			} while (u !== null && u !== t);
			if (l === null ? s = o : l.next = c, !_r(o, e.memoizedState) && ($s = !0, d && (n = oa, n !== null))) throw n;
			e.memoizedState = o, e.baseState = s, e.baseQueue = l, r.lastRenderedState = o;
		}
		return a === null && (r.lanes = 0), [e.memoizedState, r.dispatch];
	}
	function Po(e) {
		var t = Eo(), n = t.queue;
		if (n === null) throw Error(i(311));
		n.lastRenderedReducer = e;
		var r = n.dispatch, a = n.pending, o = t.memoizedState;
		if (a !== null) {
			n.pending = null;
			var s = a = a.next;
			do
				o = e(o, s.action), s = s.next;
			while (s !== a);
			_r(o, t.memoizedState) || ($s = !0), t.memoizedState = o, t.baseQueue === null && (t.baseState = o), n.lastRenderedState = o;
		}
		return [o, r];
	}
	function Fo(e, t, n) {
		var r = q, a = Eo(), o = K;
		if (o) {
			if (n === void 0) throw Error(i(407));
			n = n();
		} else n = t();
		var s = !_r((oo || a).memoizedState, n);
		if (s && (a.memoizedState = n, $s = !0), a = a.queue, os(Ro.bind(null, r, a, e), [e]), a.getSnapshot !== t || s || so !== null && so.memoizedState.tag & 1) {
			if (r.flags |= 2048, ts(9, { destroy: void 0 }, Lo.bind(null, r, a, n, t), null), Ll === null) throw Error(i(349));
			o || ao & 127 || Io(r, t, n);
		}
		return n;
	}
	function Io(e, t, n) {
		e.flags |= 16384, e = {
			getSnapshot: t,
			value: n
		}, t = q.updateQueue, t === null ? (t = Do(), q.updateQueue = t, t.stores = [e]) : (n = t.stores, n === null ? t.stores = [e] : n.push(e));
	}
	function Lo(e, t, n, r) {
		t.value = n, t.getSnapshot = r, zo(t) && Bo(e);
	}
	function Ro(e, t, n) {
		return n(function() {
			zo(t) && Bo(e);
		});
	}
	function zo(e) {
		var t = e.getSnapshot;
		e = e.value;
		try {
			var n = t();
			return !_r(e, n);
		} catch {
			return !0;
		}
	}
	function Bo(e) {
		var t = Xr(e, 2);
		t !== null && mu(t, e, 2);
	}
	function Vo(e) {
		var t = To();
		if (typeof e == "function") {
			var n = e;
			if (e = n(), uo) {
				Pe(!0);
				try {
					n();
				} finally {
					Pe(!1);
				}
			}
		}
		return t.memoizedState = t.baseState = e, t.queue = {
			pending: null,
			lanes: 0,
			dispatch: null,
			lastRenderedReducer: jo,
			lastRenderedState: e
		}, t;
	}
	function Ho(e, t, n, r) {
		return e.baseState = n, No(e, oo, typeof r == "function" ? r : jo);
	}
	function Uo(e, t, n, r, a) {
		if (js(e)) throw Error(i(485));
		if (e = t.action, e !== null) {
			var o = {
				payload: a,
				action: e,
				next: null,
				isTransition: !0,
				status: "pending",
				value: null,
				reason: null,
				listeners: [],
				then: function(e) {
					o.listeners.push(e);
				}
			};
			F.T === null ? o.isTransition = !1 : n(!0), r(o), n = t.pending, n === null ? (o.next = t.pending = o, Wo(t, o)) : (o.next = n.next, t.pending = n.next = o);
		}
	}
	function Wo(e, t) {
		var n = t.action, r = t.payload, i = e.state;
		if (t.isTransition) {
			var a = F.T, o = {};
			F.T = o;
			try {
				var s = n(i, r), c = F.S;
				c !== null && c(o, s), Go(e, t, s);
			} catch (n) {
				qo(e, t, n);
			} finally {
				a !== null && o.types !== null && (a.types = o.types), F.T = a;
			}
		} else try {
			a = n(i, r), Go(e, t, a);
		} catch (n) {
			qo(e, t, n);
		}
	}
	function Go(e, t, n) {
		typeof n == "object" && n && typeof n.then == "function" ? n.then(function(n) {
			Ko(e, t, n);
		}, function(n) {
			return qo(e, t, n);
		}) : Ko(e, t, n);
	}
	function Ko(e, t, n) {
		t.status = "fulfilled", t.value = n, Jo(t), e.state = n, t = e.pending, t !== null && (n = t.next, n === t ? e.pending = null : (n = n.next, t.next = n, Wo(e, n)));
	}
	function qo(e, t, n) {
		var r = e.pending;
		if (e.pending = null, r !== null) {
			r = r.next;
			do
				t.status = "rejected", t.reason = n, Jo(t), t = t.next;
			while (t !== r);
		}
		e.action = null;
	}
	function Jo(e) {
		e = e.listeners;
		for (var t = 0; t < e.length; t++) (0, e[t])();
	}
	function Yo(e, t) {
		return t;
	}
	function Xo(e, t) {
		if (K) {
			var n = Ll.formState;
			if (n !== null) {
				a: {
					var r = q;
					if (K) {
						if (Di) {
							b: {
								for (var i = Di, a = ki; i.nodeType !== 8;) {
									if (!a) {
										i = null;
										break b;
									}
									if (i = cf(i.nextSibling), i === null) {
										i = null;
										break b;
									}
								}
								a = i.data, i = a === "F!" || a === "F" ? i : null;
							}
							if (i) {
								Di = cf(i.nextSibling), r = i.data === "F!";
								break a;
							}
						}
						ji(r);
					}
					r = !1;
				}
				r && (t = n[0]);
			}
		}
		return n = To(), n.memoizedState = n.baseState = t, r = {
			pending: null,
			lanes: 0,
			dispatch: null,
			lastRenderedReducer: Yo,
			lastRenderedState: t
		}, n.queue = r, n = Os.bind(null, q, r), r.dispatch = n, r = Vo(!1), a = As.bind(null, q, !1, r.queue), r = To(), i = {
			state: t,
			dispatch: null,
			action: e,
			pending: null
		}, r.queue = i, n = Uo.bind(null, q, i, a, n), i.dispatch = n, r.memoizedState = e, [
			t,
			n,
			!1
		];
	}
	function Zo(e) {
		return Qo(Eo(), oo, e);
	}
	function Qo(e, t, n) {
		if (t = No(e, t, Yo)[0], e = Mo(jo)[0], typeof t == "object" && t && typeof t.then == "function") try {
			var r = Oo(t);
		} catch (e) {
			throw e === ha ? _a : e;
		}
		else r = t;
		t = Eo();
		var i = t.queue, a = i.dispatch;
		return n !== t.memoizedState && (q.flags |= 2048, ts(9, { destroy: void 0 }, $o.bind(null, i, n), null)), [
			r,
			a,
			e
		];
	}
	function $o(e, t) {
		e.action = t;
	}
	function es(e) {
		var t = Eo(), n = oo;
		if (n !== null) return Qo(t, n, e);
		Eo(), t = t.memoizedState, n = Eo();
		var r = n.queue.dispatch;
		return n.memoizedState = e, [
			t,
			r,
			!1
		];
	}
	function ts(e, t, n, r) {
		return e = {
			tag: e,
			create: n,
			deps: r,
			inst: t,
			next: null
		}, t = q.updateQueue, t === null && (t = Do(), q.updateQueue = t), n = t.lastEffect, n === null ? t.lastEffect = e.next = e : (r = n.next, n.next = e, e.next = r, t.lastEffect = e), e;
	}
	function ns() {
		return Eo().memoizedState;
	}
	function rs(e, t, n, r) {
		var i = To();
		q.flags |= e, i.memoizedState = ts(1 | t, { destroy: void 0 }, n, r === void 0 ? null : r);
	}
	function is(e, t, n, r) {
		var i = Eo();
		r = r === void 0 ? null : r;
		var a = i.memoizedState.inst;
		oo !== null && r !== null && _o(r, oo.memoizedState.deps) ? i.memoizedState = ts(t, a, n, r) : (q.flags |= e, i.memoizedState = ts(1 | t, a, n, r));
	}
	function as(e, t) {
		rs(8390656, 8, e, t);
	}
	function os(e, t) {
		is(2048, 8, e, t);
	}
	function ss(e) {
		q.flags |= 4;
		var t = q.updateQueue;
		if (t === null) t = Do(), q.updateQueue = t, t.events = [e];
		else {
			var n = t.events;
			n === null ? t.events = [e] : n.push(e);
		}
	}
	function cs(e) {
		var t = Eo().memoizedState;
		return ss({
			ref: t,
			nextImpl: e
		}), function() {
			if (J & 2) throw Error(i(440));
			return t.impl.apply(void 0, arguments);
		};
	}
	function ls(e, t) {
		return is(4, 2, e, t);
	}
	function us(e, t) {
		return is(4, 4, e, t);
	}
	function ds(e, t) {
		if (typeof t == "function") {
			e = e();
			var n = t(e);
			return function() {
				typeof n == "function" ? n() : t(null);
			};
		}
		if (t != null) return e = e(), t.current = e, function() {
			t.current = null;
		};
	}
	function fs(e, t, n) {
		n = n == null ? null : n.concat([e]), is(4, 4, ds.bind(null, t, e), n);
	}
	function ps() {}
	function ms(e, t) {
		var n = Eo();
		t = t === void 0 ? null : t;
		var r = n.memoizedState;
		return t !== null && _o(t, r[1]) ? r[0] : (n.memoizedState = [e, t], e);
	}
	function hs(e, t) {
		var n = Eo();
		t = t === void 0 ? null : t;
		var r = n.memoizedState;
		if (t !== null && _o(t, r[1])) return r[0];
		if (r = e(), uo) {
			Pe(!0);
			try {
				e();
			} finally {
				Pe(!1);
			}
		}
		return n.memoizedState = [r, t], r;
	}
	function gs(e, t, n) {
		return n === void 0 || ao & 1073741824 && !(X & 261930) ? e.memoizedState = t : (e.memoizedState = n, e = pu(), q.lanes |= e, Wl |= e, n);
	}
	function _s(e, t, n, r) {
		return _r(n, t) ? n : Ga.current === null ? !(ao & 42) || ao & 1073741824 && !(X & 261930) ? ($s = !0, e.memoizedState = n) : (e = pu(), q.lanes |= e, Wl |= e, t) : (e = gs(e, n, r), _r(e, t) || ($s = !0), e);
	}
	function vs(e, t, n, r, i) {
		var a = I.p;
		I.p = a !== 0 && 8 > a ? a : 8;
		var o = F.T, s = {};
		F.T = s, As(e, !1, t, n);
		try {
			var c = i(), l = F.S;
			l !== null && l(s, c), typeof c == "object" && c && typeof c.then == "function" ? ks(e, t, la(c, r), fu(e)) : ks(e, t, r, fu(e));
		} catch (n) {
			ks(e, t, {
				then: function() {},
				status: "rejected",
				reason: n
			}, fu());
		} finally {
			I.p = a, o !== null && s.types !== null && (o.types = s.types), F.T = o;
		}
	}
	function ys() {}
	function bs(e, t, n, r) {
		if (e.tag !== 5) throw Error(i(476));
		var a = xs(e).queue;
		vs(e, a, t, te, n === null ? ys : function() {
			return Ss(e), n(r);
		});
	}
	function xs(e) {
		var t = e.memoizedState;
		if (t !== null) return t;
		t = {
			memoizedState: te,
			baseState: te,
			baseQueue: null,
			queue: {
				pending: null,
				lanes: 0,
				dispatch: null,
				lastRenderedReducer: jo,
				lastRenderedState: te
			},
			next: null
		};
		var n = {};
		return t.next = {
			memoizedState: n,
			baseState: n,
			baseQueue: null,
			queue: {
				pending: null,
				lanes: 0,
				dispatch: null,
				lastRenderedReducer: jo,
				lastRenderedState: n
			},
			next: null
		}, e.memoizedState = t, e = e.alternate, e !== null && (e.memoizedState = t), t;
	}
	function Ss(e) {
		var t = xs(e);
		t.next === null && (t = e.alternate.memoizedState), ks(e, t.next.queue, {}, fu());
	}
	function Cs() {
		return Ji(Qf);
	}
	function ws() {
		return Eo().memoizedState;
	}
	function Ts() {
		return Eo().memoizedState;
	}
	function Es(e) {
		for (var t = e.return; t !== null;) {
			switch (t.tag) {
				case 24:
				case 3:
					var n = fu();
					e = Ia(n);
					var r = La(t, e, n);
					r !== null && (mu(r, t, n), Ra(r, t, n)), t = { cache: ta() }, e.payload = t;
					return;
			}
			t = t.return;
		}
	}
	function Ds(e, t, n) {
		var r = fu();
		n = {
			lane: r,
			revertLane: 0,
			gesture: null,
			action: n,
			hasEagerState: !1,
			eagerState: null,
			next: null
		}, js(e) ? Ms(t, n) : (n = Yr(e, t, n, r), n !== null && (mu(n, e, r), Ns(n, t, r)));
	}
	function Os(e, t, n) {
		ks(e, t, n, fu());
	}
	function ks(e, t, n, r) {
		var i = {
			lane: r,
			revertLane: 0,
			gesture: null,
			action: n,
			hasEagerState: !1,
			eagerState: null,
			next: null
		};
		if (js(e)) Ms(t, i);
		else {
			var a = e.alternate;
			if (e.lanes === 0 && (a === null || a.lanes === 0) && (a = t.lastRenderedReducer, a !== null)) try {
				var o = t.lastRenderedState, s = a(o, n);
				if (i.hasEagerState = !0, i.eagerState = s, _r(s, o)) return Jr(e, t, i, 0), Ll === null && qr(), !1;
			} catch {}
			if (n = Yr(e, t, i, r), n !== null) return mu(n, e, r), Ns(n, t, r), !0;
		}
		return !1;
	}
	function As(e, t, n, r) {
		if (r = {
			lane: 2,
			revertLane: ud(),
			gesture: null,
			action: r,
			hasEagerState: !1,
			eagerState: null,
			next: null
		}, js(e)) {
			if (t) throw Error(i(479));
		} else t = Yr(e, n, r, 2), t !== null && mu(t, e, 2);
	}
	function js(e) {
		var t = e.alternate;
		return e === q || t !== null && t === q;
	}
	function Ms(e, t) {
		lo = co = !0;
		var n = e.pending;
		n === null ? t.next = t : (t.next = n.next, n.next = t), e.pending = t;
	}
	function Ns(e, t, n) {
		if (n & 4194048) {
			var r = t.lanes;
			r &= e.pendingLanes, n |= r, t.lanes = n, Xe(e, n);
		}
	}
	var Ps = {
		readContext: Ji,
		use: ko,
		useCallback: go,
		useContext: go,
		useEffect: go,
		useImperativeHandle: go,
		useLayoutEffect: go,
		useInsertionEffect: go,
		useMemo: go,
		useReducer: go,
		useRef: go,
		useState: go,
		useDebugValue: go,
		useDeferredValue: go,
		useTransition: go,
		useSyncExternalStore: go,
		useId: go,
		useHostTransitionStatus: go,
		useFormState: go,
		useActionState: go,
		useOptimistic: go,
		useMemoCache: go,
		useCacheRefresh: go
	};
	Ps.useEffectEvent = go;
	var Fs = {
		readContext: Ji,
		use: ko,
		useCallback: function(e, t) {
			return To().memoizedState = [e, t === void 0 ? null : t], e;
		},
		useContext: Ji,
		useEffect: as,
		useImperativeHandle: function(e, t, n) {
			n = n == null ? null : n.concat([e]), rs(4194308, 4, ds.bind(null, t, e), n);
		},
		useLayoutEffect: function(e, t) {
			return rs(4194308, 4, e, t);
		},
		useInsertionEffect: function(e, t) {
			rs(4, 2, e, t);
		},
		useMemo: function(e, t) {
			var n = To();
			t = t === void 0 ? null : t;
			var r = e();
			if (uo) {
				Pe(!0);
				try {
					e();
				} finally {
					Pe(!1);
				}
			}
			return n.memoizedState = [r, t], r;
		},
		useReducer: function(e, t, n) {
			var r = To();
			if (n !== void 0) {
				var i = n(t);
				if (uo) {
					Pe(!0);
					try {
						n(t);
					} finally {
						Pe(!1);
					}
				}
			} else i = t;
			return r.memoizedState = r.baseState = i, e = {
				pending: null,
				lanes: 0,
				dispatch: null,
				lastRenderedReducer: e,
				lastRenderedState: i
			}, r.queue = e, e = e.dispatch = Ds.bind(null, q, e), [r.memoizedState, e];
		},
		useRef: function(e) {
			var t = To();
			return e = { current: e }, t.memoizedState = e;
		},
		useState: function(e) {
			e = Vo(e);
			var t = e.queue, n = Os.bind(null, q, t);
			return t.dispatch = n, [e.memoizedState, n];
		},
		useDebugValue: ps,
		useDeferredValue: function(e, t) {
			return gs(To(), e, t);
		},
		useTransition: function() {
			var e = Vo(!1);
			return e = vs.bind(null, q, e.queue, !0, !1), To().memoizedState = e, [!1, e];
		},
		useSyncExternalStore: function(e, t, n) {
			var r = q, a = To();
			if (K) {
				if (n === void 0) throw Error(i(407));
				n = n();
			} else {
				if (n = t(), Ll === null) throw Error(i(349));
				X & 127 || Io(r, t, n);
			}
			a.memoizedState = n;
			var o = {
				value: n,
				getSnapshot: t
			};
			return a.queue = o, as(Ro.bind(null, r, o, e), [e]), r.flags |= 2048, ts(9, { destroy: void 0 }, Lo.bind(null, r, o, n, t), null), n;
		},
		useId: function() {
			var e = To(), t = Ll.identifierPrefix;
			if (K) {
				var n = bi, r = yi;
				n = (r & ~(1 << 32 - Fe(r) - 1)).toString(32) + n, t = "_" + t + "R_" + n, n = fo++, 0 < n && (t += "H" + n.toString(32)), t += "_";
			} else n = ho++, t = "_" + t + "r_" + n.toString(32) + "_";
			return e.memoizedState = t;
		},
		useHostTransitionStatus: Cs,
		useFormState: Xo,
		useActionState: Xo,
		useOptimistic: function(e) {
			var t = To();
			t.memoizedState = t.baseState = e;
			var n = {
				pending: null,
				lanes: 0,
				dispatch: null,
				lastRenderedReducer: null,
				lastRenderedState: null
			};
			return t.queue = n, t = As.bind(null, q, !0, n), n.dispatch = t, [e, t];
		},
		useMemoCache: Ao,
		useCacheRefresh: function() {
			return To().memoizedState = Es.bind(null, q);
		},
		useEffectEvent: function(e) {
			var t = To(), n = { impl: e };
			return t.memoizedState = n, function() {
				if (J & 2) throw Error(i(440));
				return n.impl.apply(void 0, arguments);
			};
		}
	}, Is = {
		readContext: Ji,
		use: ko,
		useCallback: ms,
		useContext: Ji,
		useEffect: os,
		useImperativeHandle: fs,
		useInsertionEffect: ls,
		useLayoutEffect: us,
		useMemo: hs,
		useReducer: Mo,
		useRef: ns,
		useState: function() {
			return Mo(jo);
		},
		useDebugValue: ps,
		useDeferredValue: function(e, t) {
			return _s(Eo(), oo.memoizedState, e, t);
		},
		useTransition: function() {
			var e = Mo(jo)[0], t = Eo().memoizedState;
			return [typeof e == "boolean" ? e : Oo(e), t];
		},
		useSyncExternalStore: Fo,
		useId: ws,
		useHostTransitionStatus: Cs,
		useFormState: Zo,
		useActionState: Zo,
		useOptimistic: function(e, t) {
			return Ho(Eo(), oo, e, t);
		},
		useMemoCache: Ao,
		useCacheRefresh: Ts
	};
	Is.useEffectEvent = cs;
	var Ls = {
		readContext: Ji,
		use: ko,
		useCallback: ms,
		useContext: Ji,
		useEffect: os,
		useImperativeHandle: fs,
		useInsertionEffect: ls,
		useLayoutEffect: us,
		useMemo: hs,
		useReducer: Po,
		useRef: ns,
		useState: function() {
			return Po(jo);
		},
		useDebugValue: ps,
		useDeferredValue: function(e, t) {
			var n = Eo();
			return oo === null ? gs(n, e, t) : _s(n, oo.memoizedState, e, t);
		},
		useTransition: function() {
			var e = Po(jo)[0], t = Eo().memoizedState;
			return [typeof e == "boolean" ? e : Oo(e), t];
		},
		useSyncExternalStore: Fo,
		useId: ws,
		useHostTransitionStatus: Cs,
		useFormState: es,
		useActionState: es,
		useOptimistic: function(e, t) {
			var n = Eo();
			return oo === null ? (n.baseState = e, [e, n.queue.dispatch]) : Ho(n, oo, e, t);
		},
		useMemoCache: Ao,
		useCacheRefresh: Ts
	};
	Ls.useEffectEvent = cs;
	function Rs(e, t, n, r) {
		t = e.memoizedState, n = n(r, t), n = n == null ? t : h({}, t, n), e.memoizedState = n, e.lanes === 0 && (e.updateQueue.baseState = n);
	}
	var zs = {
		enqueueSetState: function(e, t, n) {
			e = e._reactInternals;
			var r = fu(), i = Ia(r);
			i.payload = t, n != null && (i.callback = n), t = La(e, i, r), t !== null && (mu(t, e, r), Ra(t, e, r));
		},
		enqueueReplaceState: function(e, t, n) {
			e = e._reactInternals;
			var r = fu(), i = Ia(r);
			i.tag = 1, i.payload = t, n != null && (i.callback = n), t = La(e, i, r), t !== null && (mu(t, e, r), Ra(t, e, r));
		},
		enqueueForceUpdate: function(e, t) {
			e = e._reactInternals;
			var n = fu(), r = Ia(n);
			r.tag = 2, t != null && (r.callback = t), t = La(e, r, n), t !== null && (mu(t, e, n), Ra(t, e, n));
		}
	};
	function Bs(e, t, n, r, i, a, o) {
		return e = e.stateNode, typeof e.shouldComponentUpdate == "function" ? e.shouldComponentUpdate(r, a, o) : t.prototype && t.prototype.isPureReactComponent ? !vr(n, r) || !vr(i, a) : !0;
	}
	function Vs(e, t, n, r) {
		e = t.state, typeof t.componentWillReceiveProps == "function" && t.componentWillReceiveProps(n, r), typeof t.UNSAFE_componentWillReceiveProps == "function" && t.UNSAFE_componentWillReceiveProps(n, r), t.state !== e && zs.enqueueReplaceState(t, t.state, null);
	}
	function Hs(e, t) {
		var n = t;
		if ("ref" in t) for (var r in n = {}, t) r !== "ref" && (n[r] = t[r]);
		if (e = e.defaultProps) for (var i in n === t && (n = h({}, n)), e) n[i] === void 0 && (n[i] = e[i]);
		return n;
	}
	function Us(e) {
		Ur(e);
	}
	function Ws(e) {
		console.error(e);
	}
	function Gs(e) {
		Ur(e);
	}
	function Ks(e, t) {
		try {
			var n = e.onUncaughtError;
			n(t.value, { componentStack: t.stack });
		} catch (e) {
			setTimeout(function() {
				throw e;
			});
		}
	}
	function qs(e, t, n) {
		try {
			var r = e.onCaughtError;
			r(n.value, {
				componentStack: n.stack,
				errorBoundary: t.tag === 1 ? t.stateNode : null
			});
		} catch (e) {
			setTimeout(function() {
				throw e;
			});
		}
	}
	function Js(e, t, n) {
		return n = Ia(n), n.tag = 3, n.payload = { element: null }, n.callback = function() {
			Ks(e, t);
		}, n;
	}
	function Ys(e) {
		return e = Ia(e), e.tag = 3, e;
	}
	function Xs(e, t, n, r) {
		var i = n.type.getDerivedStateFromError;
		if (typeof i == "function") {
			var a = r.value;
			e.payload = function() {
				return i(a);
			}, e.callback = function() {
				qs(t, n, r);
			};
		}
		var o = n.stateNode;
		o !== null && typeof o.componentDidCatch == "function" && (e.callback = function() {
			qs(t, n, r), typeof i != "function" && (nu === null ? nu = /* @__PURE__ */ new Set([this]) : nu.add(this));
			var e = r.stack;
			this.componentDidCatch(r.value, { componentStack: e === null ? "" : e });
		});
	}
	function Zs(e, t, n, r, a) {
		if (n.flags |= 32768, typeof r == "object" && r && typeof r.then == "function") {
			if (t = n.alternate, t !== null && Gi(t, n, a, !0), n = Xa.current, n !== null) {
				switch (n.tag) {
					case 31:
					case 13: return Za === null ? Eu() : n.alternate === null && Ul === 0 && (Ul = 3), n.flags &= -257, n.flags |= 65536, n.lanes = a, r === va ? n.flags |= 16384 : (t = n.updateQueue, t === null ? n.updateQueue = /* @__PURE__ */ new Set([r]) : t.add(r), Wu(e, r, a)), !1;
					case 22: return n.flags |= 65536, r === va ? n.flags |= 16384 : (t = n.updateQueue, t === null ? (t = {
						transitions: null,
						markerInstances: null,
						retryQueue: /* @__PURE__ */ new Set([r])
					}, n.updateQueue = t) : (n = t.retryQueue, n === null ? t.retryQueue = /* @__PURE__ */ new Set([r]) : n.add(r)), Wu(e, r, a)), !1;
				}
				throw Error(i(435, n.tag));
			}
			return Wu(e, r, a), Eu(), !1;
		}
		if (K) return t = Xa.current, t === null ? (r !== Ai && (t = Error(i(423), { cause: r }), Li(di(t, n))), e = e.current.alternate, e.flags |= 65536, a &= -a, e.lanes |= a, r = di(r, n), a = Js(e.stateNode, r, a), za(e, a), Ul !== 4 && (Ul = 2)) : (!(t.flags & 65536) && (t.flags |= 256), t.flags |= 65536, t.lanes = a, r !== Ai && (e = Error(i(422), { cause: r }), Li(di(e, n)))), !1;
		var o = Error(i(520), { cause: r });
		if (o = di(o, n), Yl === null ? Yl = [o] : Yl.push(o), Ul !== 4 && (Ul = 2), t === null) return !0;
		r = di(r, n), n = t;
		do {
			switch (n.tag) {
				case 3: return n.flags |= 65536, e = a & -a, n.lanes |= e, e = Js(n.stateNode, r, e), za(n, e), !1;
				case 1: if (t = n.type, o = n.stateNode, !(n.flags & 128) && (typeof t.getDerivedStateFromError == "function" || o !== null && typeof o.componentDidCatch == "function" && (nu === null || !nu.has(o)))) return n.flags |= 65536, a &= -a, n.lanes |= a, a = Ys(a), Xs(a, e, n, r), za(n, a), !1;
			}
			n = n.return;
		} while (n !== null);
		return !1;
	}
	var Qs = Error(i(461)), $s = !1;
	function ec(e, t, n, r) {
		t.child = e === null ? Ma(t, null, n, r) : ja(t, e.child, n, r);
	}
	function tc(e, t, n, r, i) {
		n = n.render;
		var a = t.ref;
		if ("ref" in r) {
			var o = {};
			for (var s in r) s !== "ref" && (o[s] = r[s]);
		} else o = r;
		return qi(t), r = vo(e, t, n, o, a, i), s = So(), e !== null && !$s ? (Co(e, t, i), Tc(e, t, i)) : (K && s && Ci(t), t.flags |= 1, ec(e, t, r, i), t.child);
	}
	function nc(e, t, n, r, i) {
		if (e === null) {
			var a = n.type;
			return typeof a == "function" && !ni(a) && a.defaultProps === void 0 && n.compare === null ? (t.tag = 15, t.type = a, rc(e, t, a, r, i)) : (e = ai(n.type, null, r, t, t.mode, i), e.ref = t.ref, e.return = t, t.child = e);
		}
		if (a = e.child, !Ec(e, i)) {
			var o = a.memoizedProps;
			if (n = n.compare, n = n === null ? vr : n, n(o, r) && e.ref === t.ref) return Tc(e, t, i);
		}
		return t.flags |= 1, e = ri(a, r), e.ref = t.ref, e.return = t, t.child = e;
	}
	function rc(e, t, n, r, i) {
		if (e !== null) {
			var a = e.memoizedProps;
			if (vr(a, r) && e.ref === t.ref) if ($s = !1, t.pendingProps = r = a, Ec(e, i)) e.flags & 131072 && ($s = !0);
			else return t.lanes = e.lanes, Tc(e, t, i);
		}
		return dc(e, t, n, r, i);
	}
	function ic(e, t, n, r) {
		var i = r.children, a = e === null ? null : e.memoizedState;
		if (e === null && t.stateNode === null && (t.stateNode = {
			_visibility: 1,
			_pendingMarkers: null,
			_retryCache: null,
			_transitions: null
		}), r.mode === "hidden") {
			if (t.flags & 128) {
				if (a = a === null ? n : a.baseLanes | n, e !== null) {
					for (r = t.child = e.child, i = 0; r !== null;) i = i | r.lanes | r.childLanes, r = r.sibling;
					r = i & ~a;
				} else r = 0, t.child = null;
				return oc(e, t, a, n, r);
			}
			if (n & 536870912) t.memoizedState = {
				baseLanes: 0,
				cachePool: null
			}, e !== null && pa(t, a === null ? null : a.cachePool), a === null ? Ja() : qa(t, a), eo(t);
			else return r = t.lanes = 536870912, oc(e, t, a === null ? n : a.baseLanes | n, n, r);
		} else a === null ? (e !== null && pa(t, null), Ja(), to(t)) : (pa(t, a.cachePool), qa(t, a), to(t), t.memoizedState = null);
		return ec(e, t, i, n), t.child;
	}
	function ac(e, t) {
		return e !== null && e.tag === 22 || t.stateNode !== null || (t.stateNode = {
			_visibility: 1,
			_pendingMarkers: null,
			_retryCache: null,
			_transitions: null
		}), t.sibling;
	}
	function oc(e, t, n, r, i) {
		var a = fa();
		return a = a === null ? null : {
			parent: ea._currentValue,
			pool: a
		}, t.memoizedState = {
			baseLanes: n,
			cachePool: a
		}, e !== null && pa(t, null), Ja(), eo(t), e !== null && Gi(e, t, r, !0), t.childLanes = i, null;
	}
	function sc(e, t) {
		return t = bc({
			mode: t.mode,
			children: t.children
		}, e.mode), t.ref = e.ref, e.child = t, t.return = e, t;
	}
	function cc(e, t, n) {
		return ja(t, e.child, null, n), e = sc(t, t.pendingProps), e.flags |= 2, no(t), t.memoizedState = null, e;
	}
	function lc(e, t, n) {
		var r = t.pendingProps, a = (t.flags & 128) != 0;
		if (t.flags &= -129, e === null) {
			if (K) {
				if (r.mode === "hidden") return e = sc(t, r), t.lanes = 536870912, ac(null, e);
				if ($a(t), (e = Di) ? (e = rf(e, ki), e = e !== null && e.data === "&" ? e : null, e !== null && (t.memoizedState = {
					dehydrated: e,
					treeContext: vi === null ? null : {
						id: yi,
						overflow: bi
					},
					retryLane: 536870912,
					hydrationErrors: null
				}, n = ci(e), n.return = t, t.child = n, Ei = t, Di = null)) : e = null, e === null) throw ji(t);
				return t.lanes = 536870912, null;
			}
			return sc(t, r);
		}
		var o = e.memoizedState;
		if (o !== null) {
			var s = o.dehydrated;
			if ($a(t), a) if (t.flags & 256) t.flags &= -257, t = cc(e, t, n);
			else if (t.memoizedState !== null) t.child = e.child, t.flags |= 128, t = null;
			else throw Error(i(558));
			else if ($s || Gi(e, t, n, !1), a = (n & e.childLanes) !== 0, $s || a) {
				if (r = Ll, r !== null && (s = Ze(r, n), s !== 0 && s !== o.retryLane)) throw o.retryLane = s, Xr(e, s), mu(r, e, s), Qs;
				Eu(), t = cc(e, t, n);
			} else e = o.treeContext, Di = cf(s.nextSibling), Ei = t, K = !0, Oi = null, ki = !1, e !== null && Ti(t, e), t = sc(t, r), t.flags |= 4096;
			return t;
		}
		return e = ri(e.child, {
			mode: r.mode,
			children: r.children
		}), e.ref = t.ref, t.child = e, e.return = t, e;
	}
	function uc(e, t) {
		var n = t.ref;
		if (n === null) e !== null && e.ref !== null && (t.flags |= 4194816);
		else {
			if (typeof n != "function" && typeof n != "object") throw Error(i(284));
			(e === null || e.ref !== n) && (t.flags |= 4194816);
		}
	}
	function dc(e, t, n, r, i) {
		return qi(t), n = vo(e, t, n, r, void 0, i), r = So(), e !== null && !$s ? (Co(e, t, i), Tc(e, t, i)) : (K && r && Ci(t), t.flags |= 1, ec(e, t, n, i), t.child);
	}
	function fc(e, t, n, r, i, a) {
		return qi(t), t.updateQueue = null, n = bo(t, r, n, i), yo(e), r = So(), e !== null && !$s ? (Co(e, t, a), Tc(e, t, a)) : (K && r && Ci(t), t.flags |= 1, ec(e, t, n, a), t.child);
	}
	function pc(e, t, n, r, i) {
		if (qi(t), t.stateNode === null) {
			var a = $r, o = n.contextType;
			typeof o == "object" && o && (a = Ji(o)), a = new n(r, a), t.memoizedState = a.state !== null && a.state !== void 0 ? a.state : null, a.updater = zs, t.stateNode = a, a._reactInternals = t, a = t.stateNode, a.props = r, a.state = t.memoizedState, a.refs = {}, Pa(t), o = n.contextType, a.context = typeof o == "object" && o ? Ji(o) : $r, a.state = t.memoizedState, o = n.getDerivedStateFromProps, typeof o == "function" && (Rs(t, n, o, r), a.state = t.memoizedState), typeof n.getDerivedStateFromProps == "function" || typeof a.getSnapshotBeforeUpdate == "function" || typeof a.UNSAFE_componentWillMount != "function" && typeof a.componentWillMount != "function" || (o = a.state, typeof a.componentWillMount == "function" && a.componentWillMount(), typeof a.UNSAFE_componentWillMount == "function" && a.UNSAFE_componentWillMount(), o !== a.state && zs.enqueueReplaceState(a, a.state, null), Ha(t, r, a, i), Va(), a.state = t.memoizedState), typeof a.componentDidMount == "function" && (t.flags |= 4194308), r = !0;
		} else if (e === null) {
			a = t.stateNode;
			var s = t.memoizedProps, c = Hs(n, s);
			a.props = c;
			var l = a.context, u = n.contextType;
			o = $r, typeof u == "object" && u && (o = Ji(u));
			var d = n.getDerivedStateFromProps;
			u = typeof d == "function" || typeof a.getSnapshotBeforeUpdate == "function", s = t.pendingProps !== s, u || typeof a.UNSAFE_componentWillReceiveProps != "function" && typeof a.componentWillReceiveProps != "function" || (s || l !== o) && Vs(t, a, r, o), Na = !1;
			var f = t.memoizedState;
			a.state = f, Ha(t, r, a, i), Va(), l = t.memoizedState, s || f !== l || Na ? (typeof d == "function" && (Rs(t, n, d, r), l = t.memoizedState), (c = Na || Bs(t, n, c, r, f, l, o)) ? (u || typeof a.UNSAFE_componentWillMount != "function" && typeof a.componentWillMount != "function" || (typeof a.componentWillMount == "function" && a.componentWillMount(), typeof a.UNSAFE_componentWillMount == "function" && a.UNSAFE_componentWillMount()), typeof a.componentDidMount == "function" && (t.flags |= 4194308)) : (typeof a.componentDidMount == "function" && (t.flags |= 4194308), t.memoizedProps = r, t.memoizedState = l), a.props = r, a.state = l, a.context = o, r = c) : (typeof a.componentDidMount == "function" && (t.flags |= 4194308), r = !1);
		} else {
			a = t.stateNode, Fa(e, t), o = t.memoizedProps, u = Hs(n, o), a.props = u, d = t.pendingProps, f = a.context, l = n.contextType, c = $r, typeof l == "object" && l && (c = Ji(l)), s = n.getDerivedStateFromProps, (l = typeof s == "function" || typeof a.getSnapshotBeforeUpdate == "function") || typeof a.UNSAFE_componentWillReceiveProps != "function" && typeof a.componentWillReceiveProps != "function" || (o !== d || f !== c) && Vs(t, a, r, c), Na = !1, f = t.memoizedState, a.state = f, Ha(t, r, a, i), Va();
			var p = t.memoizedState;
			o !== d || f !== p || Na || e !== null && e.dependencies !== null && Ki(e.dependencies) ? (typeof s == "function" && (Rs(t, n, s, r), p = t.memoizedState), (u = Na || Bs(t, n, u, r, f, p, c) || e !== null && e.dependencies !== null && Ki(e.dependencies)) ? (l || typeof a.UNSAFE_componentWillUpdate != "function" && typeof a.componentWillUpdate != "function" || (typeof a.componentWillUpdate == "function" && a.componentWillUpdate(r, p, c), typeof a.UNSAFE_componentWillUpdate == "function" && a.UNSAFE_componentWillUpdate(r, p, c)), typeof a.componentDidUpdate == "function" && (t.flags |= 4), typeof a.getSnapshotBeforeUpdate == "function" && (t.flags |= 1024)) : (typeof a.componentDidUpdate != "function" || o === e.memoizedProps && f === e.memoizedState || (t.flags |= 4), typeof a.getSnapshotBeforeUpdate != "function" || o === e.memoizedProps && f === e.memoizedState || (t.flags |= 1024), t.memoizedProps = r, t.memoizedState = p), a.props = r, a.state = p, a.context = c, r = u) : (typeof a.componentDidUpdate != "function" || o === e.memoizedProps && f === e.memoizedState || (t.flags |= 4), typeof a.getSnapshotBeforeUpdate != "function" || o === e.memoizedProps && f === e.memoizedState || (t.flags |= 1024), r = !1);
		}
		return a = r, uc(e, t), r = (t.flags & 128) != 0, a || r ? (a = t.stateNode, n = r && typeof n.getDerivedStateFromError != "function" ? null : a.render(), t.flags |= 1, e !== null && r ? (t.child = ja(t, e.child, null, i), t.child = ja(t, null, n, i)) : ec(e, t, n, i), t.memoizedState = a.state, e = t.child) : e = Tc(e, t, i), e;
	}
	function mc(e, t, n, r) {
		return Fi(), t.flags |= 256, ec(e, t, n, r), t.child;
	}
	var hc = {
		dehydrated: null,
		treeContext: null,
		retryLane: 0,
		hydrationErrors: null
	};
	function gc(e) {
		return {
			baseLanes: e,
			cachePool: ma()
		};
	}
	function _c(e, t, n) {
		return e = e === null ? 0 : e.childLanes & ~n, t && (e |= ql), e;
	}
	function vc(e, t, n) {
		var r = t.pendingProps, a = !1, o = (t.flags & 128) != 0, s;
		if ((s = o) || (s = e !== null && e.memoizedState === null ? !1 : (ro.current & 2) != 0), s && (a = !0, t.flags &= -129), s = (t.flags & 32) != 0, t.flags &= -33, e === null) {
			if (K) {
				if (a ? Qa(t) : to(t), (e = Di) ? (e = rf(e, ki), e = e !== null && e.data !== "&" ? e : null, e !== null && (t.memoizedState = {
					dehydrated: e,
					treeContext: vi === null ? null : {
						id: yi,
						overflow: bi
					},
					retryLane: 536870912,
					hydrationErrors: null
				}, n = ci(e), n.return = t, t.child = n, Ei = t, Di = null)) : e = null, e === null) throw ji(t);
				return of(e) ? t.lanes = 32 : t.lanes = 536870912, null;
			}
			var c = r.children;
			return r = r.fallback, a ? (to(t), a = t.mode, c = bc({
				mode: "hidden",
				children: c
			}, a), r = oi(r, a, n, null), c.return = t, r.return = t, c.sibling = r, t.child = c, r = t.child, r.memoizedState = gc(n), r.childLanes = _c(e, s, n), t.memoizedState = hc, ac(null, r)) : (Qa(t), yc(t, c));
		}
		var l = e.memoizedState;
		if (l !== null && (c = l.dehydrated, c !== null)) {
			if (o) t.flags & 256 ? (Qa(t), t.flags &= -257, t = xc(e, t, n)) : t.memoizedState === null ? (to(t), c = r.fallback, a = t.mode, r = bc({
				mode: "visible",
				children: r.children
			}, a), c = oi(c, a, n, null), c.flags |= 2, r.return = t, c.return = t, r.sibling = c, t.child = r, ja(t, e.child, null, n), r = t.child, r.memoizedState = gc(n), r.childLanes = _c(e, s, n), t.memoizedState = hc, t = ac(null, r)) : (to(t), t.child = e.child, t.flags |= 128, t = null);
			else if (Qa(t), of(c)) {
				if (s = c.nextSibling && c.nextSibling.dataset, s) var u = s.dgst;
				s = u, r = Error(i(419)), r.stack = "", r.digest = s, Li({
					value: r,
					source: null,
					stack: null
				}), t = xc(e, t, n);
			} else if ($s || Gi(e, t, n, !1), s = (n & e.childLanes) !== 0, $s || s) {
				if (s = Ll, s !== null && (r = Ze(s, n), r !== 0 && r !== l.retryLane)) throw l.retryLane = r, Xr(e, r), mu(s, e, r), Qs;
				af(c) || Eu(), t = xc(e, t, n);
			} else af(c) ? (t.flags |= 192, t.child = e.child, t = null) : (e = l.treeContext, Di = cf(c.nextSibling), Ei = t, K = !0, Oi = null, ki = !1, e !== null && Ti(t, e), t = yc(t, r.children), t.flags |= 4096);
			return t;
		}
		return a ? (to(t), c = r.fallback, a = t.mode, l = e.child, u = l.sibling, r = ri(l, {
			mode: "hidden",
			children: r.children
		}), r.subtreeFlags = l.subtreeFlags & 65011712, u === null ? (c = oi(c, a, n, null), c.flags |= 2) : c = ri(u, c), c.return = t, r.return = t, r.sibling = c, t.child = r, ac(null, r), r = t.child, c = e.child.memoizedState, c === null ? c = gc(n) : (a = c.cachePool, a === null ? a = ma() : (l = ea._currentValue, a = a.parent === l ? a : {
			parent: l,
			pool: l
		}), c = {
			baseLanes: c.baseLanes | n,
			cachePool: a
		}), r.memoizedState = c, r.childLanes = _c(e, s, n), t.memoizedState = hc, ac(e.child, r)) : (Qa(t), n = e.child, e = n.sibling, n = ri(n, {
			mode: "visible",
			children: r.children
		}), n.return = t, n.sibling = null, e !== null && (s = t.deletions, s === null ? (t.deletions = [e], t.flags |= 16) : s.push(e)), t.child = n, t.memoizedState = null, n);
	}
	function yc(e, t) {
		return t = bc({
			mode: "visible",
			children: t
		}, e.mode), t.return = e, e.child = t;
	}
	function bc(e, t) {
		return e = ti(22, e, null, t), e.lanes = 0, e;
	}
	function xc(e, t, n) {
		return ja(t, e.child, null, n), e = yc(t, t.pendingProps.children), e.flags |= 2, t.memoizedState = null, e;
	}
	function Sc(e, t, n) {
		e.lanes |= t;
		var r = e.alternate;
		r !== null && (r.lanes |= t), Ui(e.return, t, n);
	}
	function Cc(e, t, n, r, i, a) {
		var o = e.memoizedState;
		o === null ? e.memoizedState = {
			isBackwards: t,
			rendering: null,
			renderingStartTime: 0,
			last: r,
			tail: n,
			tailMode: i,
			treeForkCount: a
		} : (o.isBackwards = t, o.rendering = null, o.renderingStartTime = 0, o.last = r, o.tail = n, o.tailMode = i, o.treeForkCount = a);
	}
	function wc(e, t, n) {
		var r = t.pendingProps, i = r.revealOrder, a = r.tail;
		r = r.children;
		var o = ro.current, s = (o & 2) != 0;
		if (s ? (o = o & 1 | 2, t.flags |= 128) : o &= 1, R(ro, o), ec(e, t, r, n), r = K ? hi : 0, !s && e !== null && e.flags & 128) a: for (e = t.child; e !== null;) {
			if (e.tag === 13) e.memoizedState !== null && Sc(e, n, t);
			else if (e.tag === 19) Sc(e, n, t);
			else if (e.child !== null) {
				e.child.return = e, e = e.child;
				continue;
			}
			if (e === t) break a;
			for (; e.sibling === null;) {
				if (e.return === null || e.return === t) break a;
				e = e.return;
			}
			e.sibling.return = e.return, e = e.sibling;
		}
		switch (i) {
			case "forwards":
				for (n = t.child, i = null; n !== null;) e = n.alternate, e !== null && io(e) === null && (i = n), n = n.sibling;
				n = i, n === null ? (i = t.child, t.child = null) : (i = n.sibling, n.sibling = null), Cc(t, !1, i, n, a, r);
				break;
			case "backwards":
			case "unstable_legacy-backwards":
				for (n = null, i = t.child, t.child = null; i !== null;) {
					if (e = i.alternate, e !== null && io(e) === null) {
						t.child = i;
						break;
					}
					e = i.sibling, i.sibling = n, n = i, i = e;
				}
				Cc(t, !0, n, null, a, r);
				break;
			case "together":
				Cc(t, !1, null, null, void 0, r);
				break;
			default: t.memoizedState = null;
		}
		return t.child;
	}
	function Tc(e, t, n) {
		if (e !== null && (t.dependencies = e.dependencies), Wl |= t.lanes, (n & t.childLanes) === 0) if (e !== null) {
			if (Gi(e, t, n, !1), (n & t.childLanes) === 0) return null;
		} else return null;
		if (e !== null && t.child !== e.child) throw Error(i(153));
		if (t.child !== null) {
			for (e = t.child, n = ri(e, e.pendingProps), t.child = n, n.return = t; e.sibling !== null;) e = e.sibling, n = n.sibling = ri(e, e.pendingProps), n.return = t;
			n.sibling = null;
		}
		return t.child;
	}
	function Ec(e, t) {
		return (e.lanes & t) === 0 ? (e = e.dependencies, !!(e !== null && Ki(e))) : !0;
	}
	function Dc(e, t, n) {
		switch (t.tag) {
			case 3:
				le(t, t.stateNode.containerInfo), Vi(t, ea, e.memoizedState.cache), Fi();
				break;
			case 27:
			case 5:
				de(t);
				break;
			case 4:
				le(t, t.stateNode.containerInfo);
				break;
			case 10:
				Vi(t, t.type, t.memoizedProps.value);
				break;
			case 31:
				if (t.memoizedState !== null) return t.flags |= 128, $a(t), null;
				break;
			case 13:
				var r = t.memoizedState;
				if (r !== null) return r.dehydrated === null ? (n & t.child.childLanes) === 0 ? (Qa(t), e = Tc(e, t, n), e === null ? null : e.sibling) : vc(e, t, n) : (Qa(t), t.flags |= 128, null);
				Qa(t);
				break;
			case 19:
				var i = (e.flags & 128) != 0;
				if (r = (n & t.childLanes) !== 0, r ||= (Gi(e, t, n, !1), (n & t.childLanes) !== 0), i) {
					if (r) return wc(e, t, n);
					t.flags |= 128;
				}
				if (i = t.memoizedState, i !== null && (i.rendering = null, i.tail = null, i.lastEffect = null), R(ro, ro.current), r) break;
				return null;
			case 22: return t.lanes = 0, ic(e, t, n, t.pendingProps);
			case 24: Vi(t, ea, e.memoizedState.cache);
		}
		return Tc(e, t, n);
	}
	function Oc(e, t, n) {
		if (e !== null) if (e.memoizedProps !== t.pendingProps) $s = !0;
		else {
			if (!Ec(e, n) && !(t.flags & 128)) return $s = !1, Dc(e, t, n);
			$s = !!(e.flags & 131072);
		}
		else $s = !1, K && t.flags & 1048576 && Si(t, hi, t.index);
		switch (t.lanes = 0, t.tag) {
			case 16:
				a: {
					var r = t.pendingProps;
					if (e = xa(t.elementType), t.type = e, typeof e == "function") ni(e) ? (r = Hs(e, r), t.tag = 1, t = pc(null, t, e, r, n)) : (t.tag = 0, t = dc(null, t, e, r, n));
					else {
						if (e != null) {
							var a = e.$$typeof;
							if (a === w) {
								t.tag = 11, t = tc(null, t, e, r, n);
								break a;
							} else if (a === D) {
								t.tag = 14, t = nc(null, t, e, r, n);
								break a;
							}
						}
						throw t = ee(e) || e, Error(i(306, t, ""));
					}
				}
				return t;
			case 0: return dc(e, t, t.type, t.pendingProps, n);
			case 1: return r = t.type, a = Hs(r, t.pendingProps), pc(e, t, r, a, n);
			case 3:
				a: {
					if (le(t, t.stateNode.containerInfo), e === null) throw Error(i(387));
					r = t.pendingProps;
					var o = t.memoizedState;
					a = o.element, Fa(e, t), Ha(t, r, null, n);
					var s = t.memoizedState;
					if (r = s.cache, Vi(t, ea, r), r !== o.cache && Wi(t, [ea], n, !0), Va(), r = s.element, o.isDehydrated) if (o = {
						element: r,
						isDehydrated: !1,
						cache: s.cache
					}, t.updateQueue.baseState = o, t.memoizedState = o, t.flags & 256) {
						t = mc(e, t, r, n);
						break a;
					} else if (r !== a) {
						a = di(Error(i(424)), t), Li(a), t = mc(e, t, r, n);
						break a;
					} else {
						switch (e = t.stateNode.containerInfo, e.nodeType) {
							case 9:
								e = e.body;
								break;
							default: e = e.nodeName === "HTML" ? e.ownerDocument.body : e;
						}
						for (Di = cf(e.firstChild), Ei = t, K = !0, Oi = null, ki = !0, n = Ma(t, null, r, n), t.child = n; n;) n.flags = n.flags & -3 | 4096, n = n.sibling;
					}
					else {
						if (Fi(), r === a) {
							t = Tc(e, t, n);
							break a;
						}
						ec(e, t, r, n);
					}
					t = t.child;
				}
				return t;
			case 26: return uc(e, t), e === null ? (n = kf(t.type, null, t.pendingProps, null)) ? t.memoizedState = n : K || (n = t.type, e = t.pendingProps, r = Bd(se.current).createElement(n), r[rt] = t, r[it] = e, Pd(r, n, e), mt(r), t.stateNode = r) : t.memoizedState = kf(t.type, e.memoizedProps, t.pendingProps, e.memoizedState), null;
			case 27: return de(t), e === null && K && (r = t.stateNode = ff(t.type, t.pendingProps, se.current), Ei = t, ki = !0, a = Di, Zd(t.type) ? (lf = a, Di = cf(r.firstChild)) : Di = a), ec(e, t, t.pendingProps.children, n), uc(e, t), e === null && (t.flags |= 4194304), t.child;
			case 5: return e === null && K && ((a = r = Di) && (r = tf(r, t.type, t.pendingProps, ki), r === null ? a = !1 : (t.stateNode = r, Ei = t, Di = cf(r.firstChild), ki = !1, a = !0)), a || ji(t)), de(t), a = t.type, o = t.pendingProps, s = e === null ? null : e.memoizedProps, r = o.children, Ud(a, o) ? r = null : s !== null && Ud(a, s) && (t.flags |= 32), t.memoizedState !== null && (a = vo(e, t, xo, null, null, n), Qf._currentValue = a), uc(e, t), ec(e, t, r, n), t.child;
			case 6: return e === null && K && ((e = n = Di) && (n = nf(n, t.pendingProps, ki), n === null ? e = !1 : (t.stateNode = n, Ei = t, Di = null, e = !0)), e || ji(t)), null;
			case 13: return vc(e, t, n);
			case 4: return le(t, t.stateNode.containerInfo), r = t.pendingProps, e === null ? t.child = ja(t, null, r, n) : ec(e, t, r, n), t.child;
			case 11: return tc(e, t, t.type, t.pendingProps, n);
			case 7: return ec(e, t, t.pendingProps, n), t.child;
			case 8: return ec(e, t, t.pendingProps.children, n), t.child;
			case 12: return ec(e, t, t.pendingProps.children, n), t.child;
			case 10: return r = t.pendingProps, Vi(t, t.type, r.value), ec(e, t, r.children, n), t.child;
			case 9: return a = t.type._context, r = t.pendingProps.children, qi(t), a = Ji(a), r = r(a), t.flags |= 1, ec(e, t, r, n), t.child;
			case 14: return nc(e, t, t.type, t.pendingProps, n);
			case 15: return rc(e, t, t.type, t.pendingProps, n);
			case 19: return wc(e, t, n);
			case 31: return lc(e, t, n);
			case 22: return ic(e, t, n, t.pendingProps);
			case 24: return qi(t), r = Ji(ea), e === null ? (a = fa(), a === null && (a = Ll, o = ta(), a.pooledCache = o, o.refCount++, o !== null && (a.pooledCacheLanes |= n), a = o), t.memoizedState = {
				parent: r,
				cache: a
			}, Pa(t), Vi(t, ea, a)) : ((e.lanes & n) !== 0 && (Fa(e, t), Ha(t, null, null, n), Va()), a = e.memoizedState, o = t.memoizedState, a.parent === r ? (r = o.cache, Vi(t, ea, r), r !== a.cache && Wi(t, [ea], n, !0)) : (a = {
				parent: r,
				cache: r
			}, t.memoizedState = a, t.lanes === 0 && (t.memoizedState = t.updateQueue.baseState = a), Vi(t, ea, r))), ec(e, t, t.pendingProps.children, n), t.child;
			case 29: throw t.pendingProps;
		}
		throw Error(i(156, t.tag));
	}
	function kc(e) {
		e.flags |= 4;
	}
	function Ac(e, t, n, r, i) {
		if ((t = (e.mode & 32) != 0) && (t = !1), t) {
			if (e.flags |= 16777216, (i & 335544128) === i) if (e.stateNode.complete) e.flags |= 8192;
			else if (Cu()) e.flags |= 8192;
			else throw Sa = va, ga;
		} else e.flags &= -16777217;
	}
	function jc(e, t) {
		if (t.type !== "stylesheet" || t.state.loading & 4) e.flags &= -16777217;
		else if (e.flags |= 16777216, !Wf(t)) if (Cu()) e.flags |= 8192;
		else throw Sa = va, ga;
	}
	function Mc(e, t) {
		t !== null && (e.flags |= 4), e.flags & 16384 && (t = e.tag === 22 ? 536870912 : Ge(), e.lanes |= t, Jl |= t);
	}
	function Nc(e, t) {
		if (!K) switch (e.tailMode) {
			case "hidden":
				t = e.tail;
				for (var n = null; t !== null;) t.alternate !== null && (n = t), t = t.sibling;
				n === null ? e.tail = null : n.sibling = null;
				break;
			case "collapsed":
				n = e.tail;
				for (var r = null; n !== null;) n.alternate !== null && (r = n), n = n.sibling;
				r === null ? t || e.tail === null ? e.tail = null : e.tail.sibling = null : r.sibling = null;
		}
	}
	function Pc(e) {
		var t = e.alternate !== null && e.alternate.child === e.child, n = 0, r = 0;
		if (t) for (var i = e.child; i !== null;) n |= i.lanes | i.childLanes, r |= i.subtreeFlags & 65011712, r |= i.flags & 65011712, i.return = e, i = i.sibling;
		else for (i = e.child; i !== null;) n |= i.lanes | i.childLanes, r |= i.subtreeFlags, r |= i.flags, i.return = e, i = i.sibling;
		return e.subtreeFlags |= r, e.childLanes = n, t;
	}
	function Fc(e, t, n) {
		var r = t.pendingProps;
		switch (wi(t), t.tag) {
			case 16:
			case 15:
			case 0:
			case 11:
			case 7:
			case 8:
			case 12:
			case 9:
			case 14: return Pc(t), null;
			case 1: return Pc(t), null;
			case 3: return n = t.stateNode, r = null, e !== null && (r = e.memoizedState.cache), t.memoizedState.cache !== r && (t.flags |= 2048), Hi(ea), ue(), n.pendingContext && (n.context = n.pendingContext, n.pendingContext = null), (e === null || e.child === null) && (Pi(t) ? kc(t) : e === null || e.memoizedState.isDehydrated && !(t.flags & 256) || (t.flags |= 1024, Ii())), Pc(t), null;
			case 26:
				var a = t.type, o = t.memoizedState;
				return e === null ? (kc(t), o === null ? (Pc(t), Ac(t, a, null, r, n)) : (Pc(t), jc(t, o))) : o ? o === e.memoizedState ? (Pc(t), t.flags &= -16777217) : (kc(t), Pc(t), jc(t, o)) : (e = e.memoizedProps, e !== r && kc(t), Pc(t), Ac(t, a, e, r, n)), null;
			case 27:
				if (fe(t), n = se.current, a = t.type, e !== null && t.stateNode != null) e.memoizedProps !== r && kc(t);
				else {
					if (!r) {
						if (t.stateNode === null) throw Error(i(166));
						return Pc(t), null;
					}
					e = ae.current, Pi(t) ? Mi(t, e) : (e = ff(a, r, n), t.stateNode = e, kc(t));
				}
				return Pc(t), null;
			case 5:
				if (fe(t), a = t.type, e !== null && t.stateNode != null) e.memoizedProps !== r && kc(t);
				else {
					if (!r) {
						if (t.stateNode === null) throw Error(i(166));
						return Pc(t), null;
					}
					if (o = ae.current, Pi(t)) Mi(t, o);
					else {
						var s = Bd(se.current);
						switch (o) {
							case 1:
								o = s.createElementNS("http://www.w3.org/2000/svg", a);
								break;
							case 2:
								o = s.createElementNS("http://www.w3.org/1998/Math/MathML", a);
								break;
							default: switch (a) {
								case "svg":
									o = s.createElementNS("http://www.w3.org/2000/svg", a);
									break;
								case "math":
									o = s.createElementNS("http://www.w3.org/1998/Math/MathML", a);
									break;
								case "script":
									o = s.createElement("div"), o.innerHTML = "<script><\/script>", o = o.removeChild(o.firstChild);
									break;
								case "select":
									o = typeof r.is == "string" ? s.createElement("select", { is: r.is }) : s.createElement("select"), r.multiple ? o.multiple = !0 : r.size && (o.size = r.size);
									break;
								default: o = typeof r.is == "string" ? s.createElement(a, { is: r.is }) : s.createElement(a);
							}
						}
						o[rt] = t, o[it] = r;
						a: for (s = t.child; s !== null;) {
							if (s.tag === 5 || s.tag === 6) o.appendChild(s.stateNode);
							else if (s.tag !== 4 && s.tag !== 27 && s.child !== null) {
								s.child.return = s, s = s.child;
								continue;
							}
							if (s === t) break a;
							for (; s.sibling === null;) {
								if (s.return === null || s.return === t) break a;
								s = s.return;
							}
							s.sibling.return = s.return, s = s.sibling;
						}
						t.stateNode = o;
						a: switch (Pd(o, a, r), a) {
							case "button":
							case "input":
							case "select":
							case "textarea":
								r = !!r.autoFocus;
								break a;
							case "img":
								r = !0;
								break a;
							default: r = !1;
						}
						r && kc(t);
					}
				}
				return Pc(t), Ac(t, t.type, e === null ? null : e.memoizedProps, t.pendingProps, n), null;
			case 6:
				if (e && t.stateNode != null) e.memoizedProps !== r && kc(t);
				else {
					if (typeof r != "string" && t.stateNode === null) throw Error(i(166));
					if (e = se.current, Pi(t)) {
						if (e = t.stateNode, n = t.memoizedProps, r = null, a = Ei, a !== null) switch (a.tag) {
							case 27:
							case 5: r = a.memoizedProps;
						}
						e[rt] = t, e = !!(e.nodeValue === n || r !== null && !0 === r.suppressHydrationWarning || jd(e.nodeValue, n)), e || ji(t, !0);
					} else e = Bd(e).createTextNode(r), e[rt] = t, t.stateNode = e;
				}
				return Pc(t), null;
			case 31:
				if (n = t.memoizedState, e === null || e.memoizedState !== null) {
					if (r = Pi(t), n !== null) {
						if (e === null) {
							if (!r) throw Error(i(318));
							if (e = t.memoizedState, e = e === null ? null : e.dehydrated, !e) throw Error(i(557));
							e[rt] = t;
						} else Fi(), !(t.flags & 128) && (t.memoizedState = null), t.flags |= 4;
						Pc(t), e = !1;
					} else n = Ii(), e !== null && e.memoizedState !== null && (e.memoizedState.hydrationErrors = n), e = !0;
					if (!e) return t.flags & 256 ? (no(t), t) : (no(t), null);
					if (t.flags & 128) throw Error(i(558));
				}
				return Pc(t), null;
			case 13:
				if (r = t.memoizedState, e === null || e.memoizedState !== null && e.memoizedState.dehydrated !== null) {
					if (a = Pi(t), r !== null && r.dehydrated !== null) {
						if (e === null) {
							if (!a) throw Error(i(318));
							if (a = t.memoizedState, a = a === null ? null : a.dehydrated, !a) throw Error(i(317));
							a[rt] = t;
						} else Fi(), !(t.flags & 128) && (t.memoizedState = null), t.flags |= 4;
						Pc(t), a = !1;
					} else a = Ii(), e !== null && e.memoizedState !== null && (e.memoizedState.hydrationErrors = a), a = !0;
					if (!a) return t.flags & 256 ? (no(t), t) : (no(t), null);
				}
				return no(t), t.flags & 128 ? (t.lanes = n, t) : (n = r !== null, e = e !== null && e.memoizedState !== null, n && (r = t.child, a = null, r.alternate !== null && r.alternate.memoizedState !== null && r.alternate.memoizedState.cachePool !== null && (a = r.alternate.memoizedState.cachePool.pool), o = null, r.memoizedState !== null && r.memoizedState.cachePool !== null && (o = r.memoizedState.cachePool.pool), o !== a && (r.flags |= 2048)), n !== e && n && (t.child.flags |= 8192), Mc(t, t.updateQueue), Pc(t), null);
			case 4: return ue(), e === null && xd(t.stateNode.containerInfo), Pc(t), null;
			case 10: return Hi(t.type), Pc(t), null;
			case 19:
				if (ie(ro), r = t.memoizedState, r === null) return Pc(t), null;
				if (a = (t.flags & 128) != 0, o = r.rendering, o === null) if (a) Nc(r, !1);
				else {
					if (Ul !== 0 || e !== null && e.flags & 128) for (e = t.child; e !== null;) {
						if (o = io(e), o !== null) {
							for (t.flags |= 128, Nc(r, !1), e = o.updateQueue, t.updateQueue = e, Mc(t, e), t.subtreeFlags = 0, e = n, n = t.child; n !== null;) ii(n, e), n = n.sibling;
							return R(ro, ro.current & 1 | 2), K && xi(t, r.treeForkCount), t.child;
						}
						e = e.sibling;
					}
					r.tail !== null && z() > eu && (t.flags |= 128, a = !0, Nc(r, !1), t.lanes = 4194304);
				}
				else {
					if (!a) if (e = io(o), e !== null) {
						if (t.flags |= 128, a = !0, e = e.updateQueue, t.updateQueue = e, Mc(t, e), Nc(r, !0), r.tail === null && r.tailMode === "hidden" && !o.alternate && !K) return Pc(t), null;
					} else 2 * z() - r.renderingStartTime > eu && n !== 536870912 && (t.flags |= 128, a = !0, Nc(r, !1), t.lanes = 4194304);
					r.isBackwards ? (o.sibling = t.child, t.child = o) : (e = r.last, e === null ? t.child = o : e.sibling = o, r.last = o);
				}
				return r.tail === null ? (Pc(t), null) : (e = r.tail, r.rendering = e, r.tail = e.sibling, r.renderingStartTime = z(), e.sibling = null, n = ro.current, R(ro, a ? n & 1 | 2 : n & 1), K && xi(t, r.treeForkCount), e);
			case 22:
			case 23: return no(t), Ya(), r = t.memoizedState !== null, e === null ? r && (t.flags |= 8192) : e.memoizedState !== null !== r && (t.flags |= 8192), r ? n & 536870912 && !(t.flags & 128) && (Pc(t), t.subtreeFlags & 6 && (t.flags |= 8192)) : Pc(t), n = t.updateQueue, n !== null && Mc(t, n.retryQueue), n = null, e !== null && e.memoizedState !== null && e.memoizedState.cachePool !== null && (n = e.memoizedState.cachePool.pool), r = null, t.memoizedState !== null && t.memoizedState.cachePool !== null && (r = t.memoizedState.cachePool.pool), r !== n && (t.flags |= 2048), e !== null && ie(da), null;
			case 24: return n = null, e !== null && (n = e.memoizedState.cache), t.memoizedState.cache !== n && (t.flags |= 2048), Hi(ea), Pc(t), null;
			case 25: return null;
			case 30: return null;
		}
		throw Error(i(156, t.tag));
	}
	function Ic(e, t) {
		switch (wi(t), t.tag) {
			case 1: return e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
			case 3: return Hi(ea), ue(), e = t.flags, e & 65536 && !(e & 128) ? (t.flags = e & -65537 | 128, t) : null;
			case 26:
			case 27:
			case 5: return fe(t), null;
			case 31:
				if (t.memoizedState !== null) {
					if (no(t), t.alternate === null) throw Error(i(340));
					Fi();
				}
				return e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
			case 13:
				if (no(t), e = t.memoizedState, e !== null && e.dehydrated !== null) {
					if (t.alternate === null) throw Error(i(340));
					Fi();
				}
				return e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
			case 19: return ie(ro), null;
			case 4: return ue(), null;
			case 10: return Hi(t.type), null;
			case 22:
			case 23: return no(t), Ya(), e !== null && ie(da), e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
			case 24: return Hi(ea), null;
			case 25: return null;
			default: return null;
		}
	}
	function Lc(e, t) {
		switch (wi(t), t.tag) {
			case 3:
				Hi(ea), ue();
				break;
			case 26:
			case 27:
			case 5:
				fe(t);
				break;
			case 4:
				ue();
				break;
			case 31:
				t.memoizedState !== null && no(t);
				break;
			case 13:
				no(t);
				break;
			case 19:
				ie(ro);
				break;
			case 10:
				Hi(t.type);
				break;
			case 22:
			case 23:
				no(t), Ya(), e !== null && ie(da);
				break;
			case 24: Hi(ea);
		}
	}
	function Rc(e, t) {
		try {
			var n = t.updateQueue, r = n === null ? null : n.lastEffect;
			if (r !== null) {
				var i = r.next;
				n = i;
				do {
					if ((n.tag & e) === e) {
						r = void 0;
						var a = n.create, o = n.inst;
						r = a(), o.destroy = r;
					}
					n = n.next;
				} while (n !== i);
			}
		} catch (e) {
			Q(t, t.return, e);
		}
	}
	function zc(e, t, n) {
		try {
			var r = t.updateQueue, i = r === null ? null : r.lastEffect;
			if (i !== null) {
				var a = i.next;
				r = a;
				do {
					if ((r.tag & e) === e) {
						var o = r.inst, s = o.destroy;
						if (s !== void 0) {
							o.destroy = void 0, i = t;
							var c = n, l = s;
							try {
								l();
							} catch (e) {
								Q(i, c, e);
							}
						}
					}
					r = r.next;
				} while (r !== a);
			}
		} catch (e) {
			Q(t, t.return, e);
		}
	}
	function Bc(e) {
		var t = e.updateQueue;
		if (t !== null) {
			var n = e.stateNode;
			try {
				Wa(t, n);
			} catch (t) {
				Q(e, e.return, t);
			}
		}
	}
	function Vc(e, t, n) {
		n.props = Hs(e.type, e.memoizedProps), n.state = e.memoizedState;
		try {
			n.componentWillUnmount();
		} catch (n) {
			Q(e, t, n);
		}
	}
	function Hc(e, t) {
		try {
			var n = e.ref;
			if (n !== null) {
				switch (e.tag) {
					case 26:
					case 27:
					case 5:
						var r = e.stateNode;
						break;
					case 30:
						r = e.stateNode;
						break;
					default: r = e.stateNode;
				}
				typeof n == "function" ? e.refCleanup = n(r) : n.current = r;
			}
		} catch (n) {
			Q(e, t, n);
		}
	}
	function Uc(e, t) {
		var n = e.ref, r = e.refCleanup;
		if (n !== null) if (typeof r == "function") try {
			r();
		} catch (n) {
			Q(e, t, n);
		} finally {
			e.refCleanup = null, e = e.alternate, e != null && (e.refCleanup = null);
		}
		else if (typeof n == "function") try {
			n(null);
		} catch (n) {
			Q(e, t, n);
		}
		else n.current = null;
	}
	function Wc(e) {
		var t = e.type, n = e.memoizedProps, r = e.stateNode;
		try {
			a: switch (t) {
				case "button":
				case "input":
				case "select":
				case "textarea":
					n.autoFocus && r.focus();
					break a;
				case "img": n.src ? r.src = n.src : n.srcSet && (r.srcset = n.srcSet);
			}
		} catch (t) {
			Q(e, e.return, t);
		}
	}
	function Gc(e, t, n) {
		try {
			var r = e.stateNode;
			Fd(r, e.type, n, t), r[it] = t;
		} catch (t) {
			Q(e, e.return, t);
		}
	}
	function Kc(e) {
		return e.tag === 5 || e.tag === 3 || e.tag === 26 || e.tag === 27 && Zd(e.type) || e.tag === 4;
	}
	function qc(e) {
		a: for (;;) {
			for (; e.sibling === null;) {
				if (e.return === null || Kc(e.return)) return null;
				e = e.return;
			}
			for (e.sibling.return = e.return, e = e.sibling; e.tag !== 5 && e.tag !== 6 && e.tag !== 18;) {
				if (e.tag === 27 && Zd(e.type) || e.flags & 2 || e.child === null || e.tag === 4) continue a;
				e.child.return = e, e = e.child;
			}
			if (!(e.flags & 2)) return e.stateNode;
		}
	}
	function Jc(e, t, n) {
		var r = e.tag;
		if (r === 5 || r === 6) e = e.stateNode, t ? (n.nodeType === 9 ? n.body : n.nodeName === "HTML" ? n.ownerDocument.body : n).insertBefore(e, t) : (t = n.nodeType === 9 ? n.body : n.nodeName === "HTML" ? n.ownerDocument.body : n, t.appendChild(e), n = n._reactRootContainer, n != null || t.onclick !== null || (t.onclick = Jt));
		else if (r !== 4 && (r === 27 && Zd(e.type) && (n = e.stateNode, t = null), e = e.child, e !== null)) for (Jc(e, t, n), e = e.sibling; e !== null;) Jc(e, t, n), e = e.sibling;
	}
	function Yc(e, t, n) {
		var r = e.tag;
		if (r === 5 || r === 6) e = e.stateNode, t ? n.insertBefore(e, t) : n.appendChild(e);
		else if (r !== 4 && (r === 27 && Zd(e.type) && (n = e.stateNode), e = e.child, e !== null)) for (Yc(e, t, n), e = e.sibling; e !== null;) Yc(e, t, n), e = e.sibling;
	}
	function Xc(e) {
		var t = e.stateNode, n = e.memoizedProps;
		try {
			for (var r = e.type, i = t.attributes; i.length;) t.removeAttributeNode(i[0]);
			Pd(t, r, n), t[rt] = e, t[it] = n;
		} catch (t) {
			Q(e, e.return, t);
		}
	}
	var Zc = !1, Qc = !1, $c = !1, el = typeof WeakSet == "function" ? WeakSet : Set, tl = null;
	function nl(e, t) {
		if (e = e.containerInfo, Rd = sp, e = Sr(e), Cr(e)) {
			if ("selectionStart" in e) var n = {
				start: e.selectionStart,
				end: e.selectionEnd
			};
			else a: {
				n = (n = e.ownerDocument) && n.defaultView || window;
				var r = n.getSelection && n.getSelection();
				if (r && r.rangeCount !== 0) {
					n = r.anchorNode;
					var a = r.anchorOffset, o = r.focusNode;
					r = r.focusOffset;
					try {
						n.nodeType, o.nodeType;
					} catch {
						n = null;
						break a;
					}
					var s = 0, c = -1, l = -1, u = 0, d = 0, f = e, p = null;
					b: for (;;) {
						for (var m; f !== n || a !== 0 && f.nodeType !== 3 || (c = s + a), f !== o || r !== 0 && f.nodeType !== 3 || (l = s + r), f.nodeType === 3 && (s += f.nodeValue.length), (m = f.firstChild) !== null;) p = f, f = m;
						for (;;) {
							if (f === e) break b;
							if (p === n && ++u === a && (c = s), p === o && ++d === r && (l = s), (m = f.nextSibling) !== null) break;
							f = p, p = f.parentNode;
						}
						f = m;
					}
					n = c === -1 || l === -1 ? null : {
						start: c,
						end: l
					};
				} else n = null;
			}
			n ||= {
				start: 0,
				end: 0
			};
		} else n = null;
		for (zd = {
			focusedElem: e,
			selectionRange: n
		}, sp = !1, tl = t; tl !== null;) if (t = tl, e = t.child, t.subtreeFlags & 1028 && e !== null) e.return = t, tl = e;
		else for (; tl !== null;) {
			switch (t = tl, o = t.alternate, e = t.flags, t.tag) {
				case 0:
					if (e & 4 && (e = t.updateQueue, e = e === null ? null : e.events, e !== null)) for (n = 0; n < e.length; n++) a = e[n], a.ref.impl = a.nextImpl;
					break;
				case 11:
				case 15: break;
				case 1:
					if (e & 1024 && o !== null) {
						e = void 0, n = t, a = o.memoizedProps, o = o.memoizedState, r = n.stateNode;
						try {
							var h = Hs(n.type, a);
							e = r.getSnapshotBeforeUpdate(h, o), r.__reactInternalSnapshotBeforeUpdate = e;
						} catch (e) {
							Q(n, n.return, e);
						}
					}
					break;
				case 3:
					if (e & 1024) {
						if (e = t.stateNode.containerInfo, n = e.nodeType, n === 9) ef(e);
						else if (n === 1) switch (e.nodeName) {
							case "HEAD":
							case "HTML":
							case "BODY":
								ef(e);
								break;
							default: e.textContent = "";
						}
					}
					break;
				case 5:
				case 26:
				case 27:
				case 6:
				case 4:
				case 17: break;
				default: if (e & 1024) throw Error(i(163));
			}
			if (e = t.sibling, e !== null) {
				e.return = t.return, tl = e;
				break;
			}
			tl = t.return;
		}
	}
	function rl(e, t, n) {
		var r = n.flags;
		switch (n.tag) {
			case 0:
			case 11:
			case 15:
				vl(e, n), r & 4 && Rc(5, n);
				break;
			case 1:
				if (vl(e, n), r & 4) if (e = n.stateNode, t === null) try {
					e.componentDidMount();
				} catch (e) {
					Q(n, n.return, e);
				}
				else {
					var i = Hs(n.type, t.memoizedProps);
					t = t.memoizedState;
					try {
						e.componentDidUpdate(i, t, e.__reactInternalSnapshotBeforeUpdate);
					} catch (e) {
						Q(n, n.return, e);
					}
				}
				r & 64 && Bc(n), r & 512 && Hc(n, n.return);
				break;
			case 3:
				if (vl(e, n), r & 64 && (e = n.updateQueue, e !== null)) {
					if (t = null, n.child !== null) switch (n.child.tag) {
						case 27:
						case 5:
							t = n.child.stateNode;
							break;
						case 1: t = n.child.stateNode;
					}
					try {
						Wa(e, t);
					} catch (e) {
						Q(n, n.return, e);
					}
				}
				break;
			case 27: t === null && r & 4 && Xc(n);
			case 26:
			case 5:
				vl(e, n), t === null && r & 4 && Wc(n), r & 512 && Hc(n, n.return);
				break;
			case 12:
				vl(e, n);
				break;
			case 31:
				vl(e, n), r & 4 && ll(e, n);
				break;
			case 13:
				vl(e, n), r & 4 && ul(e, n), r & 64 && (e = n.memoizedState, e !== null && (e = e.dehydrated, e !== null && (n = qu.bind(null, n), sf(e, n))));
				break;
			case 22:
				if (r = n.memoizedState !== null || Zc, !r) {
					t = t !== null && t.memoizedState !== null || Qc, i = Zc;
					var a = Qc;
					Zc = r, (Qc = t) && !a ? bl(e, n, (n.subtreeFlags & 8772) != 0) : vl(e, n), Zc = i, Qc = a;
				}
				break;
			case 30: break;
			default: vl(e, n);
		}
	}
	function il(e) {
		var t = e.alternate;
		t !== null && (e.alternate = null, il(t)), e.child = null, e.deletions = null, e.sibling = null, e.tag === 5 && (t = e.stateNode, t !== null && lt(t)), e.stateNode = null, e.return = null, e.dependencies = null, e.memoizedProps = null, e.memoizedState = null, e.pendingProps = null, e.stateNode = null, e.updateQueue = null;
	}
	var al = null, ol = !1;
	function sl(e, t, n) {
		for (n = n.child; n !== null;) cl(e, t, n), n = n.sibling;
	}
	function cl(e, t, n) {
		if (B && typeof B.onCommitFiberUnmount == "function") try {
			B.onCommitFiberUnmount(Ne, n);
		} catch {}
		switch (n.tag) {
			case 26:
				Qc || Uc(n, t), sl(e, t, n), n.memoizedState ? n.memoizedState.count-- : n.stateNode && (n = n.stateNode, n.parentNode.removeChild(n));
				break;
			case 27:
				Qc || Uc(n, t);
				var r = al, i = ol;
				Zd(n.type) && (al = n.stateNode, ol = !1), sl(e, t, n), pf(n.stateNode), al = r, ol = i;
				break;
			case 5: Qc || Uc(n, t);
			case 6:
				if (r = al, i = ol, al = null, sl(e, t, n), al = r, ol = i, al !== null) if (ol) try {
					(al.nodeType === 9 ? al.body : al.nodeName === "HTML" ? al.ownerDocument.body : al).removeChild(n.stateNode);
				} catch (e) {
					Q(n, t, e);
				}
				else try {
					al.removeChild(n.stateNode);
				} catch (e) {
					Q(n, t, e);
				}
				break;
			case 18:
				al !== null && (ol ? (e = al, Qd(e.nodeType === 9 ? e.body : e.nodeName === "HTML" ? e.ownerDocument.body : e, n.stateNode), Np(e)) : Qd(al, n.stateNode));
				break;
			case 4:
				r = al, i = ol, al = n.stateNode.containerInfo, ol = !0, sl(e, t, n), al = r, ol = i;
				break;
			case 0:
			case 11:
			case 14:
			case 15:
				zc(2, n, t), Qc || zc(4, n, t), sl(e, t, n);
				break;
			case 1:
				Qc || (Uc(n, t), r = n.stateNode, typeof r.componentWillUnmount == "function" && Vc(n, t, r)), sl(e, t, n);
				break;
			case 21:
				sl(e, t, n);
				break;
			case 22:
				Qc = (r = Qc) || n.memoizedState !== null, sl(e, t, n), Qc = r;
				break;
			default: sl(e, t, n);
		}
	}
	function ll(e, t) {
		if (t.memoizedState === null && (e = t.alternate, e !== null && (e = e.memoizedState, e !== null))) {
			e = e.dehydrated;
			try {
				Np(e);
			} catch (e) {
				Q(t, t.return, e);
			}
		}
	}
	function ul(e, t) {
		if (t.memoizedState === null && (e = t.alternate, e !== null && (e = e.memoizedState, e !== null && (e = e.dehydrated, e !== null)))) try {
			Np(e);
		} catch (e) {
			Q(t, t.return, e);
		}
	}
	function dl(e) {
		switch (e.tag) {
			case 31:
			case 13:
			case 19:
				var t = e.stateNode;
				return t === null && (t = e.stateNode = new el()), t;
			case 22: return e = e.stateNode, t = e._retryCache, t === null && (t = e._retryCache = new el()), t;
			default: throw Error(i(435, e.tag));
		}
	}
	function fl(e, t) {
		var n = dl(e);
		t.forEach(function(t) {
			if (!n.has(t)) {
				n.add(t);
				var r = Ju.bind(null, e, t);
				t.then(r, r);
			}
		});
	}
	function pl(e, t) {
		var n = t.deletions;
		if (n !== null) for (var r = 0; r < n.length; r++) {
			var a = n[r], o = e, s = t, c = s;
			a: for (; c !== null;) {
				switch (c.tag) {
					case 27:
						if (Zd(c.type)) {
							al = c.stateNode, ol = !1;
							break a;
						}
						break;
					case 5:
						al = c.stateNode, ol = !1;
						break a;
					case 3:
					case 4:
						al = c.stateNode.containerInfo, ol = !0;
						break a;
				}
				c = c.return;
			}
			if (al === null) throw Error(i(160));
			cl(o, s, a), al = null, ol = !1, o = a.alternate, o !== null && (o.return = null), a.return = null;
		}
		if (t.subtreeFlags & 13886) for (t = t.child; t !== null;) hl(t, e), t = t.sibling;
	}
	var ml = null;
	function hl(e, t) {
		var n = e.alternate, r = e.flags;
		switch (e.tag) {
			case 0:
			case 11:
			case 14:
			case 15:
				pl(t, e), gl(e), r & 4 && (zc(3, e, e.return), Rc(3, e), zc(5, e, e.return));
				break;
			case 1:
				pl(t, e), gl(e), r & 512 && (Qc || n === null || Uc(n, n.return)), r & 64 && Zc && (e = e.updateQueue, e !== null && (r = e.callbacks, r !== null && (n = e.shared.hiddenCallbacks, e.shared.hiddenCallbacks = n === null ? r : n.concat(r))));
				break;
			case 26:
				var a = ml;
				if (pl(t, e), gl(e), r & 512 && (Qc || n === null || Uc(n, n.return)), r & 4) {
					var o = n === null ? null : n.memoizedState;
					if (r = e.memoizedState, n === null) if (r === null) if (e.stateNode === null) {
						a: {
							r = e.type, n = e.memoizedProps, a = a.ownerDocument || a;
							b: switch (r) {
								case "title":
									o = a.getElementsByTagName("title")[0], (!o || o[ct] || o[rt] || o.namespaceURI === "http://www.w3.org/2000/svg" || o.hasAttribute("itemprop")) && (o = a.createElement(r), a.head.insertBefore(o, a.querySelector("head > title"))), Pd(o, r, n), o[rt] = e, mt(o), r = o;
									break a;
								case "link":
									var s = Vf("link", "href", a).get(r + (n.href || ""));
									if (s) {
										for (var c = 0; c < s.length; c++) if (o = s[c], o.getAttribute("href") === (n.href == null || n.href === "" ? null : n.href) && o.getAttribute("rel") === (n.rel == null ? null : n.rel) && o.getAttribute("title") === (n.title == null ? null : n.title) && o.getAttribute("crossorigin") === (n.crossOrigin == null ? null : n.crossOrigin)) {
											s.splice(c, 1);
											break b;
										}
									}
									o = a.createElement(r), Pd(o, r, n), a.head.appendChild(o);
									break;
								case "meta":
									if (s = Vf("meta", "content", a).get(r + (n.content || ""))) {
										for (c = 0; c < s.length; c++) if (o = s[c], o.getAttribute("content") === (n.content == null ? null : "" + n.content) && o.getAttribute("name") === (n.name == null ? null : n.name) && o.getAttribute("property") === (n.property == null ? null : n.property) && o.getAttribute("http-equiv") === (n.httpEquiv == null ? null : n.httpEquiv) && o.getAttribute("charset") === (n.charSet == null ? null : n.charSet)) {
											s.splice(c, 1);
											break b;
										}
									}
									o = a.createElement(r), Pd(o, r, n), a.head.appendChild(o);
									break;
								default: throw Error(i(468, r));
							}
							o[rt] = e, mt(o), r = o;
						}
						e.stateNode = r;
					} else Hf(a, e.type, e.stateNode);
					else e.stateNode = If(a, r, e.memoizedProps);
					else o === r ? r === null && e.stateNode !== null && Gc(e, e.memoizedProps, n.memoizedProps) : (o === null ? n.stateNode !== null && (n = n.stateNode, n.parentNode.removeChild(n)) : o.count--, r === null ? Hf(a, e.type, e.stateNode) : If(a, r, e.memoizedProps));
				}
				break;
			case 27:
				pl(t, e), gl(e), r & 512 && (Qc || n === null || Uc(n, n.return)), n !== null && r & 4 && Gc(e, e.memoizedProps, n.memoizedProps);
				break;
			case 5:
				if (pl(t, e), gl(e), r & 512 && (Qc || n === null || Uc(n, n.return)), e.flags & 32) {
					a = e.stateNode;
					try {
						Bt(a, "");
					} catch (t) {
						Q(e, e.return, t);
					}
				}
				r & 4 && e.stateNode != null && (a = e.memoizedProps, Gc(e, a, n === null ? a : n.memoizedProps)), r & 1024 && ($c = !0);
				break;
			case 6:
				if (pl(t, e), gl(e), r & 4) {
					if (e.stateNode === null) throw Error(i(162));
					r = e.memoizedProps, n = e.stateNode;
					try {
						n.nodeValue = r;
					} catch (t) {
						Q(e, e.return, t);
					}
				}
				break;
			case 3:
				if (Bf = null, a = ml, ml = gf(t.containerInfo), pl(t, e), ml = a, gl(e), r & 4 && n !== null && n.memoizedState.isDehydrated) try {
					Np(t.containerInfo);
				} catch (t) {
					Q(e, e.return, t);
				}
				$c && ($c = !1, _l(e));
				break;
			case 4:
				r = ml, ml = gf(e.stateNode.containerInfo), pl(t, e), gl(e), ml = r;
				break;
			case 12:
				pl(t, e), gl(e);
				break;
			case 31:
				pl(t, e), gl(e), r & 4 && (r = e.updateQueue, r !== null && (e.updateQueue = null, fl(e, r)));
				break;
			case 13:
				pl(t, e), gl(e), e.child.flags & 8192 && e.memoizedState !== null != (n !== null && n.memoizedState !== null) && (Ql = z()), r & 4 && (r = e.updateQueue, r !== null && (e.updateQueue = null, fl(e, r)));
				break;
			case 22:
				a = e.memoizedState !== null;
				var l = n !== null && n.memoizedState !== null, u = Zc, d = Qc;
				if (Zc = u || a, Qc = d || l, pl(t, e), Qc = d, Zc = u, gl(e), r & 8192) a: for (t = e.stateNode, t._visibility = a ? t._visibility & -2 : t._visibility | 1, a && (n === null || l || Zc || Qc || yl(e)), n = null, t = e;;) {
					if (t.tag === 5 || t.tag === 26) {
						if (n === null) {
							l = n = t;
							try {
								if (o = l.stateNode, a) s = o.style, typeof s.setProperty == "function" ? s.setProperty("display", "none", "important") : s.display = "none";
								else {
									c = l.stateNode;
									var f = l.memoizedProps.style, p = f != null && f.hasOwnProperty("display") ? f.display : null;
									c.style.display = p == null || typeof p == "boolean" ? "" : ("" + p).trim();
								}
							} catch (e) {
								Q(l, l.return, e);
							}
						}
					} else if (t.tag === 6) {
						if (n === null) {
							l = t;
							try {
								l.stateNode.nodeValue = a ? "" : l.memoizedProps;
							} catch (e) {
								Q(l, l.return, e);
							}
						}
					} else if (t.tag === 18) {
						if (n === null) {
							l = t;
							try {
								var m = l.stateNode;
								a ? $d(m, !0) : $d(l.stateNode, !1);
							} catch (e) {
								Q(l, l.return, e);
							}
						}
					} else if ((t.tag !== 22 && t.tag !== 23 || t.memoizedState === null || t === e) && t.child !== null) {
						t.child.return = t, t = t.child;
						continue;
					}
					if (t === e) break a;
					for (; t.sibling === null;) {
						if (t.return === null || t.return === e) break a;
						n === t && (n = null), t = t.return;
					}
					n === t && (n = null), t.sibling.return = t.return, t = t.sibling;
				}
				r & 4 && (r = e.updateQueue, r !== null && (n = r.retryQueue, n !== null && (r.retryQueue = null, fl(e, n))));
				break;
			case 19:
				pl(t, e), gl(e), r & 4 && (r = e.updateQueue, r !== null && (e.updateQueue = null, fl(e, r)));
				break;
			case 30: break;
			case 21: break;
			default: pl(t, e), gl(e);
		}
	}
	function gl(e) {
		var t = e.flags;
		if (t & 2) {
			try {
				for (var n, r = e.return; r !== null;) {
					if (Kc(r)) {
						n = r;
						break;
					}
					r = r.return;
				}
				if (n == null) throw Error(i(160));
				switch (n.tag) {
					case 27:
						var a = n.stateNode;
						Yc(e, qc(e), a);
						break;
					case 5:
						var o = n.stateNode;
						n.flags & 32 && (Bt(o, ""), n.flags &= -33), Yc(e, qc(e), o);
						break;
					case 3:
					case 4:
						var s = n.stateNode.containerInfo;
						Jc(e, qc(e), s);
						break;
					default: throw Error(i(161));
				}
			} catch (t) {
				Q(e, e.return, t);
			}
			e.flags &= -3;
		}
		t & 4096 && (e.flags &= -4097);
	}
	function _l(e) {
		if (e.subtreeFlags & 1024) for (e = e.child; e !== null;) {
			var t = e;
			_l(t), t.tag === 5 && t.flags & 1024 && t.stateNode.reset(), e = e.sibling;
		}
	}
	function vl(e, t) {
		if (t.subtreeFlags & 8772) for (t = t.child; t !== null;) rl(e, t.alternate, t), t = t.sibling;
	}
	function yl(e) {
		for (e = e.child; e !== null;) {
			var t = e;
			switch (t.tag) {
				case 0:
				case 11:
				case 14:
				case 15:
					zc(4, t, t.return), yl(t);
					break;
				case 1:
					Uc(t, t.return);
					var n = t.stateNode;
					typeof n.componentWillUnmount == "function" && Vc(t, t.return, n), yl(t);
					break;
				case 27: pf(t.stateNode);
				case 26:
				case 5:
					Uc(t, t.return), yl(t);
					break;
				case 22:
					t.memoizedState === null && yl(t);
					break;
				case 30:
					yl(t);
					break;
				default: yl(t);
			}
			e = e.sibling;
		}
	}
	function bl(e, t, n) {
		for (n &&= (t.subtreeFlags & 8772) != 0, t = t.child; t !== null;) {
			var r = t.alternate, i = e, a = t, o = a.flags;
			switch (a.tag) {
				case 0:
				case 11:
				case 15:
					bl(i, a, n), Rc(4, a);
					break;
				case 1:
					if (bl(i, a, n), r = a, i = r.stateNode, typeof i.componentDidMount == "function") try {
						i.componentDidMount();
					} catch (e) {
						Q(r, r.return, e);
					}
					if (r = a, i = r.updateQueue, i !== null) {
						var s = r.stateNode;
						try {
							var c = i.shared.hiddenCallbacks;
							if (c !== null) for (i.shared.hiddenCallbacks = null, i = 0; i < c.length; i++) Ua(c[i], s);
						} catch (e) {
							Q(r, r.return, e);
						}
					}
					n && o & 64 && Bc(a), Hc(a, a.return);
					break;
				case 27: Xc(a);
				case 26:
				case 5:
					bl(i, a, n), n && r === null && o & 4 && Wc(a), Hc(a, a.return);
					break;
				case 12:
					bl(i, a, n);
					break;
				case 31:
					bl(i, a, n), n && o & 4 && ll(i, a);
					break;
				case 13:
					bl(i, a, n), n && o & 4 && ul(i, a);
					break;
				case 22:
					a.memoizedState === null && bl(i, a, n), Hc(a, a.return);
					break;
				case 30: break;
				default: bl(i, a, n);
			}
			t = t.sibling;
		}
	}
	function xl(e, t) {
		var n = null;
		e !== null && e.memoizedState !== null && e.memoizedState.cachePool !== null && (n = e.memoizedState.cachePool.pool), e = null, t.memoizedState !== null && t.memoizedState.cachePool !== null && (e = t.memoizedState.cachePool.pool), e !== n && (e != null && e.refCount++, n != null && na(n));
	}
	function Sl(e, t) {
		e = null, t.alternate !== null && (e = t.alternate.memoizedState.cache), t = t.memoizedState.cache, t !== e && (t.refCount++, e != null && na(e));
	}
	function Cl(e, t, n, r) {
		if (t.subtreeFlags & 10256) for (t = t.child; t !== null;) wl(e, t, n, r), t = t.sibling;
	}
	function wl(e, t, n, r) {
		var i = t.flags;
		switch (t.tag) {
			case 0:
			case 11:
			case 15:
				Cl(e, t, n, r), i & 2048 && Rc(9, t);
				break;
			case 1:
				Cl(e, t, n, r);
				break;
			case 3:
				Cl(e, t, n, r), i & 2048 && (e = null, t.alternate !== null && (e = t.alternate.memoizedState.cache), t = t.memoizedState.cache, t !== e && (t.refCount++, e != null && na(e)));
				break;
			case 12:
				if (i & 2048) {
					Cl(e, t, n, r), e = t.stateNode;
					try {
						var a = t.memoizedProps, o = a.id, s = a.onPostCommit;
						typeof s == "function" && s(o, t.alternate === null ? "mount" : "update", e.passiveEffectDuration, -0);
					} catch (e) {
						Q(t, t.return, e);
					}
				} else Cl(e, t, n, r);
				break;
			case 31:
				Cl(e, t, n, r);
				break;
			case 13:
				Cl(e, t, n, r);
				break;
			case 23: break;
			case 22:
				a = t.stateNode, o = t.alternate, t.memoizedState === null ? a._visibility & 2 ? Cl(e, t, n, r) : (a._visibility |= 2, Tl(e, t, n, r, (t.subtreeFlags & 10256) != 0 || !1)) : a._visibility & 2 ? Cl(e, t, n, r) : El(e, t), i & 2048 && xl(o, t);
				break;
			case 24:
				Cl(e, t, n, r), i & 2048 && Sl(t.alternate, t);
				break;
			default: Cl(e, t, n, r);
		}
	}
	function Tl(e, t, n, r, i) {
		for (i &&= (t.subtreeFlags & 10256) != 0 || !1, t = t.child; t !== null;) {
			var a = e, o = t, s = n, c = r, l = o.flags;
			switch (o.tag) {
				case 0:
				case 11:
				case 15:
					Tl(a, o, s, c, i), Rc(8, o);
					break;
				case 23: break;
				case 22:
					var u = o.stateNode;
					o.memoizedState === null ? (u._visibility |= 2, Tl(a, o, s, c, i)) : u._visibility & 2 ? Tl(a, o, s, c, i) : El(a, o), i && l & 2048 && xl(o.alternate, o);
					break;
				case 24:
					Tl(a, o, s, c, i), i && l & 2048 && Sl(o.alternate, o);
					break;
				default: Tl(a, o, s, c, i);
			}
			t = t.sibling;
		}
	}
	function El(e, t) {
		if (t.subtreeFlags & 10256) for (t = t.child; t !== null;) {
			var n = e, r = t, i = r.flags;
			switch (r.tag) {
				case 22:
					El(n, r), i & 2048 && xl(r.alternate, r);
					break;
				case 24:
					El(n, r), i & 2048 && Sl(r.alternate, r);
					break;
				default: El(n, r);
			}
			t = t.sibling;
		}
	}
	var Dl = 8192;
	function Ol(e, t, n) {
		if (e.subtreeFlags & Dl) for (e = e.child; e !== null;) kl(e, t, n), e = e.sibling;
	}
	function kl(e, t, n) {
		switch (e.tag) {
			case 26:
				Ol(e, t, n), e.flags & Dl && e.memoizedState !== null && Gf(n, ml, e.memoizedState, e.memoizedProps);
				break;
			case 5:
				Ol(e, t, n);
				break;
			case 3:
			case 4:
				var r = ml;
				ml = gf(e.stateNode.containerInfo), Ol(e, t, n), ml = r;
				break;
			case 22:
				e.memoizedState === null && (r = e.alternate, r !== null && r.memoizedState !== null ? (r = Dl, Dl = 16777216, Ol(e, t, n), Dl = r) : Ol(e, t, n));
				break;
			default: Ol(e, t, n);
		}
	}
	function Al(e) {
		var t = e.alternate;
		if (t !== null && (e = t.child, e !== null)) {
			t.child = null;
			do
				t = e.sibling, e.sibling = null, e = t;
			while (e !== null);
		}
	}
	function jl(e) {
		var t = e.deletions;
		if (e.flags & 16) {
			if (t !== null) for (var n = 0; n < t.length; n++) {
				var r = t[n];
				tl = r, Pl(r, e);
			}
			Al(e);
		}
		if (e.subtreeFlags & 10256) for (e = e.child; e !== null;) Ml(e), e = e.sibling;
	}
	function Ml(e) {
		switch (e.tag) {
			case 0:
			case 11:
			case 15:
				jl(e), e.flags & 2048 && zc(9, e, e.return);
				break;
			case 3:
				jl(e);
				break;
			case 12:
				jl(e);
				break;
			case 22:
				var t = e.stateNode;
				e.memoizedState !== null && t._visibility & 2 && (e.return === null || e.return.tag !== 13) ? (t._visibility &= -3, Nl(e)) : jl(e);
				break;
			default: jl(e);
		}
	}
	function Nl(e) {
		var t = e.deletions;
		if (e.flags & 16) {
			if (t !== null) for (var n = 0; n < t.length; n++) {
				var r = t[n];
				tl = r, Pl(r, e);
			}
			Al(e);
		}
		for (e = e.child; e !== null;) {
			switch (t = e, t.tag) {
				case 0:
				case 11:
				case 15:
					zc(8, t, t.return), Nl(t);
					break;
				case 22:
					n = t.stateNode, n._visibility & 2 && (n._visibility &= -3, Nl(t));
					break;
				default: Nl(t);
			}
			e = e.sibling;
		}
	}
	function Pl(e, t) {
		for (; tl !== null;) {
			var n = tl;
			switch (n.tag) {
				case 0:
				case 11:
				case 15:
					zc(8, n, t);
					break;
				case 23:
				case 22:
					if (n.memoizedState !== null && n.memoizedState.cachePool !== null) {
						var r = n.memoizedState.cachePool.pool;
						r != null && r.refCount++;
					}
					break;
				case 24: na(n.memoizedState.cache);
			}
			if (r = n.child, r !== null) r.return = n, tl = r;
			else a: for (n = e; tl !== null;) {
				r = tl;
				var i = r.sibling, a = r.return;
				if (il(r), r === n) {
					tl = null;
					break a;
				}
				if (i !== null) {
					i.return = a, tl = i;
					break a;
				}
				tl = a;
			}
		}
	}
	var Fl = {
		getCacheForType: function(e) {
			var t = Ji(ea), n = t.data.get(e);
			return n === void 0 && (n = e(), t.data.set(e, n)), n;
		},
		cacheSignal: function() {
			return Ji(ea).controller.signal;
		}
	}, Il = typeof WeakMap == "function" ? WeakMap : Map, J = 0, Ll = null, Y = null, X = 0, Z = 0, Rl = null, zl = !1, Bl = !1, Vl = !1, Hl = 0, Ul = 0, Wl = 0, Gl = 0, Kl = 0, ql = 0, Jl = 0, Yl = null, Xl = null, Zl = !1, Ql = 0, $l = 0, eu = Infinity, tu = null, nu = null, ru = 0, iu = null, au = null, ou = 0, su = 0, cu = null, lu = null, uu = 0, du = null;
	function fu() {
		return J & 2 && X !== 0 ? X & -X : F.T === null ? et() : ud();
	}
	function pu() {
		if (ql === 0) if (!(X & 536870912) || K) {
			var e = Be;
			Be <<= 1, !(Be & 3932160) && (Be = 262144), ql = e;
		} else ql = 536870912;
		return e = Xa.current, e !== null && (e.flags |= 32), ql;
	}
	function mu(e, t, n) {
		(e === Ll && (Z === 2 || Z === 9) || e.cancelPendingCommit !== null) && (xu(e, 0), vu(e, X, ql, !1)), qe(e, n), (!(J & 2) || e !== Ll) && (e === Ll && (!(J & 2) && (Gl |= n), Ul === 4 && vu(e, X, ql, !1)), nd(e));
	}
	function hu(e, t, n) {
		if (J & 6) throw Error(i(327));
		var r = !n && (t & 127) == 0 && (t & e.expiredLanes) === 0 || Ue(e, t), a = r ? ku(e, t) : Du(e, t, !0), o = r;
		do {
			if (a === 0) {
				Bl && !r && vu(e, t, 0, !1);
				break;
			} else {
				if (n = e.current.alternate, o && !_u(n)) {
					a = Du(e, t, !1), o = !1;
					continue;
				}
				if (a === 2) {
					if (o = t, e.errorRecoveryDisabledLanes & o) var s = 0;
					else s = e.pendingLanes & -536870913, s = s === 0 ? s & 536870912 ? 536870912 : 0 : s;
					if (s !== 0) {
						t = s;
						a: {
							var c = e;
							a = Yl;
							var l = c.current.memoizedState.isDehydrated;
							if (l && (xu(c, s).flags |= 256), s = Du(c, s, !1), s !== 2) {
								if (Vl && !l) {
									c.errorRecoveryDisabledLanes |= o, Gl |= o, a = 4;
									break a;
								}
								o = Xl, Xl = a, o !== null && (Xl === null ? Xl = o : Xl.push.apply(Xl, o));
							}
							a = s;
						}
						if (o = !1, a !== 2) continue;
					}
				}
				if (a === 1) {
					xu(e, 0), vu(e, t, 0, !0);
					break;
				}
				a: {
					switch (r = e, o = a, o) {
						case 0:
						case 1: throw Error(i(345));
						case 4: if ((t & 4194048) !== t) break;
						case 6:
							vu(r, t, ql, !zl);
							break a;
						case 2:
							Xl = null;
							break;
						case 3:
						case 5: break;
						default: throw Error(i(329));
					}
					if ((t & 62914560) === t && (a = Ql + 300 - z(), 10 < a)) {
						if (vu(r, t, ql, !zl), V(r, 0, !0) !== 0) break a;
						ou = t, r.timeoutHandle = Kd(gu.bind(null, r, n, Xl, tu, Zl, t, ql, Gl, Jl, zl, o, "Throttled", -0, 0), a);
						break a;
					}
					gu(r, n, Xl, tu, Zl, t, ql, Gl, Jl, zl, o, null, -0, 0);
				}
			}
			break;
		} while (1);
		nd(e);
	}
	function gu(e, t, n, r, i, a, o, s, c, l, u, d, f, p) {
		if (e.timeoutHandle = -1, d = t.subtreeFlags, d & 8192 || (d & 16785408) == 16785408) {
			d = {
				stylesheets: null,
				count: 0,
				imgCount: 0,
				imgBytes: 0,
				suspenseyImages: [],
				waitingForImages: !0,
				waitingForViewTransition: !1,
				unsuspend: Jt
			}, kl(t, a, d);
			var m = (a & 62914560) === a ? Ql - z() : (a & 4194048) === a ? $l - z() : 0;
			if (m = qf(d, m), m !== null) {
				ou = a, e.cancelPendingCommit = m(Iu.bind(null, e, t, a, n, r, i, o, s, c, u, d, null, f, p)), vu(e, a, o, !l);
				return;
			}
		}
		Iu(e, t, a, n, r, i, o, s, c);
	}
	function _u(e) {
		for (var t = e;;) {
			var n = t.tag;
			if ((n === 0 || n === 11 || n === 15) && t.flags & 16384 && (n = t.updateQueue, n !== null && (n = n.stores, n !== null))) for (var r = 0; r < n.length; r++) {
				var i = n[r], a = i.getSnapshot;
				i = i.value;
				try {
					if (!_r(a(), i)) return !1;
				} catch {
					return !1;
				}
			}
			if (n = t.child, t.subtreeFlags & 16384 && n !== null) n.return = t, t = n;
			else {
				if (t === e) break;
				for (; t.sibling === null;) {
					if (t.return === null || t.return === e) return !0;
					t = t.return;
				}
				t.sibling.return = t.return, t = t.sibling;
			}
		}
		return !0;
	}
	function vu(e, t, n, r) {
		t &= ~Kl, t &= ~Gl, e.suspendedLanes |= t, e.pingedLanes &= ~t, r && (e.warmLanes |= t), r = e.expirationTimes;
		for (var i = t; 0 < i;) {
			var a = 31 - Fe(i), o = 1 << a;
			r[a] = -1, i &= ~o;
		}
		n !== 0 && Ye(e, n, t);
	}
	function yu() {
		return J & 6 ? !0 : (rd(0, !1), !1);
	}
	function bu() {
		if (Y !== null) {
			if (Z === 0) var e = Y.return;
			else e = Y, Bi = zi = null, wo(e), Ta = null, Ea = 0, e = Y;
			for (; e !== null;) Lc(e.alternate, e), e = e.return;
			Y = null;
		}
	}
	function xu(e, t) {
		var n = e.timeoutHandle;
		n !== -1 && (e.timeoutHandle = -1, qd(n)), n = e.cancelPendingCommit, n !== null && (e.cancelPendingCommit = null, n()), ou = 0, bu(), Ll = e, Y = n = ri(e.current, null), X = t, Z = 0, Rl = null, zl = !1, Bl = Ue(e, t), Vl = !1, Jl = ql = Kl = Gl = Wl = Ul = 0, Xl = Yl = null, Zl = !1, t & 8 && (t |= t & 32);
		var r = e.entangledLanes;
		if (r !== 0) for (e = e.entanglements, r &= t; 0 < r;) {
			var i = 31 - Fe(r), a = 1 << i;
			t |= e[i], r &= ~a;
		}
		return Hl = t, qr(), n;
	}
	function Su(e, t) {
		q = null, F.H = Ps, t === ha || t === _a ? (t = Ca(), Z = 3) : t === ga ? (t = Ca(), Z = 4) : Z = t === Qs ? 8 : typeof t == "object" && t && typeof t.then == "function" ? 6 : 1, Rl = t, Y === null && (Ul = 1, Ks(e, di(t, e.current)));
	}
	function Cu() {
		var e = Xa.current;
		return e === null ? !0 : (X & 4194048) === X ? Za === null : (X & 62914560) === X || X & 536870912 ? e === Za : !1;
	}
	function wu() {
		var e = F.H;
		return F.H = Ps, e === null ? Ps : e;
	}
	function Tu() {
		var e = F.A;
		return F.A = Fl, e;
	}
	function Eu() {
		Ul = 4, zl || (X & 4194048) !== X && Xa.current !== null || (Bl = !0), !(Wl & 134217727) && !(Gl & 134217727) || Ll === null || vu(Ll, X, ql, !1);
	}
	function Du(e, t, n) {
		var r = J;
		J |= 2;
		var i = wu(), a = Tu();
		(Ll !== e || X !== t) && (tu = null, xu(e, t)), t = !1;
		var o = Ul;
		a: do
			try {
				if (Z !== 0 && Y !== null) {
					var s = Y, c = Rl;
					switch (Z) {
						case 8:
							bu(), o = 6;
							break a;
						case 3:
						case 2:
						case 9:
						case 6:
							Xa.current === null && (t = !0);
							var l = Z;
							if (Z = 0, Rl = null, Nu(e, s, c, l), n && Bl) {
								o = 0;
								break a;
							}
							break;
						default: l = Z, Z = 0, Rl = null, Nu(e, s, c, l);
					}
				}
				Ou(), o = Ul;
				break;
			} catch (t) {
				Su(e, t);
			}
		while (1);
		return t && e.shellSuspendCounter++, Bi = zi = null, J = r, F.H = i, F.A = a, Y === null && (Ll = null, X = 0, qr()), o;
	}
	function Ou() {
		for (; Y !== null;) ju(Y);
	}
	function ku(e, t) {
		var n = J;
		J |= 2;
		var r = wu(), a = Tu();
		Ll !== e || X !== t ? (tu = null, eu = z() + 500, xu(e, t)) : Bl = Ue(e, t);
		a: do
			try {
				if (Z !== 0 && Y !== null) {
					t = Y;
					var o = Rl;
					b: switch (Z) {
						case 1:
							Z = 0, Rl = null, Nu(e, t, o, 1);
							break;
						case 2:
						case 9:
							if (ya(o)) {
								Z = 0, Rl = null, Mu(t);
								break;
							}
							t = function() {
								Z !== 2 && Z !== 9 || Ll !== e || (Z = 7), nd(e);
							}, o.then(t, t);
							break a;
						case 3:
							Z = 7;
							break a;
						case 4:
							Z = 5;
							break a;
						case 7:
							ya(o) ? (Z = 0, Rl = null, Mu(t)) : (Z = 0, Rl = null, Nu(e, t, o, 7));
							break;
						case 5:
							var s = null;
							switch (Y.tag) {
								case 26: s = Y.memoizedState;
								case 5:
								case 27:
									var c = Y;
									if (s ? Wf(s) : c.stateNode.complete) {
										Z = 0, Rl = null;
										var l = c.sibling;
										if (l !== null) Y = l;
										else {
											var u = c.return;
											u === null ? Y = null : (Y = u, Pu(u));
										}
										break b;
									}
							}
							Z = 0, Rl = null, Nu(e, t, o, 5);
							break;
						case 6:
							Z = 0, Rl = null, Nu(e, t, o, 6);
							break;
						case 8:
							bu(), Ul = 6;
							break a;
						default: throw Error(i(462));
					}
				}
				Au();
				break;
			} catch (t) {
				Su(e, t);
			}
		while (1);
		return Bi = zi = null, F.H = r, F.A = a, J = n, Y === null ? (Ll = null, X = 0, qr(), Ul) : 0;
	}
	function Au() {
		for (; Y !== null && !Ce();) ju(Y);
	}
	function ju(e) {
		var t = Oc(e.alternate, e, Hl);
		e.memoizedProps = e.pendingProps, t === null ? Pu(e) : Y = t;
	}
	function Mu(e) {
		var t = e, n = t.alternate;
		switch (t.tag) {
			case 15:
			case 0:
				t = fc(n, t, t.pendingProps, t.type, void 0, X);
				break;
			case 11:
				t = fc(n, t, t.pendingProps, t.type.render, t.ref, X);
				break;
			case 5: wo(t);
			default: Lc(n, t), t = Y = ii(t, Hl), t = Oc(n, t, Hl);
		}
		e.memoizedProps = e.pendingProps, t === null ? Pu(e) : Y = t;
	}
	function Nu(e, t, n, r) {
		Bi = zi = null, wo(t), Ta = null, Ea = 0;
		var i = t.return;
		try {
			if (Zs(e, i, t, n, X)) {
				Ul = 1, Ks(e, di(n, e.current)), Y = null;
				return;
			}
		} catch (t) {
			if (i !== null) throw Y = i, t;
			Ul = 1, Ks(e, di(n, e.current)), Y = null;
			return;
		}
		t.flags & 32768 ? (K || r === 1 ? e = !0 : Bl || X & 536870912 ? e = !1 : (zl = e = !0, (r === 2 || r === 9 || r === 3 || r === 6) && (r = Xa.current, r !== null && r.tag === 13 && (r.flags |= 16384))), Fu(t, e)) : Pu(t);
	}
	function Pu(e) {
		var t = e;
		do {
			if (t.flags & 32768) {
				Fu(t, zl);
				return;
			}
			e = t.return;
			var n = Fc(t.alternate, t, Hl);
			if (n !== null) {
				Y = n;
				return;
			}
			if (t = t.sibling, t !== null) {
				Y = t;
				return;
			}
			Y = t = e;
		} while (t !== null);
		Ul === 0 && (Ul = 5);
	}
	function Fu(e, t) {
		do {
			var n = Ic(e.alternate, e);
			if (n !== null) {
				n.flags &= 32767, Y = n;
				return;
			}
			if (n = e.return, n !== null && (n.flags |= 32768, n.subtreeFlags = 0, n.deletions = null), !t && (e = e.sibling, e !== null)) {
				Y = e;
				return;
			}
			Y = e = n;
		} while (e !== null);
		Ul = 6, Y = null;
	}
	function Iu(e, t, n, r, a, o, s, c, l) {
		e.cancelPendingCommit = null;
		do
			Vu();
		while (ru !== 0);
		if (J & 6) throw Error(i(327));
		if (t !== null) {
			if (t === e.current) throw Error(i(177));
			if (o = t.lanes | t.childLanes, o |= Kr, Je(e, n, o, s, c, l), e === Ll && (Y = Ll = null, X = 0), au = t, iu = e, ou = n, su = o, cu = a, lu = r, t.subtreeFlags & 10256 || t.flags & 10256 ? (e.callbackNode = null, e.callbackPriority = 0, Yu(Oe, function() {
				return Hu(), null;
			})) : (e.callbackNode = null, e.callbackPriority = 0), r = (t.flags & 13878) != 0, t.subtreeFlags & 13878 || r) {
				r = F.T, F.T = null, a = I.p, I.p = 2, s = J, J |= 4;
				try {
					nl(e, t, n);
				} finally {
					J = s, I.p = a, F.T = r;
				}
			}
			ru = 1, Lu(), Ru(), zu();
		}
	}
	function Lu() {
		if (ru === 1) {
			ru = 0;
			var e = iu, t = au, n = (t.flags & 13878) != 0;
			if (t.subtreeFlags & 13878 || n) {
				n = F.T, F.T = null;
				var r = I.p;
				I.p = 2;
				var i = J;
				J |= 4;
				try {
					hl(t, e);
					var a = zd, o = Sr(e.containerInfo), s = a.focusedElem, c = a.selectionRange;
					if (o !== s && s && s.ownerDocument && xr(s.ownerDocument.documentElement, s)) {
						if (c !== null && Cr(s)) {
							var l = c.start, u = c.end;
							if (u === void 0 && (u = l), "selectionStart" in s) s.selectionStart = l, s.selectionEnd = Math.min(u, s.value.length);
							else {
								var d = s.ownerDocument || document, f = d && d.defaultView || window;
								if (f.getSelection) {
									var p = f.getSelection(), m = s.textContent.length, h = Math.min(c.start, m), g = c.end === void 0 ? h : Math.min(c.end, m);
									!p.extend && h > g && (o = g, g = h, h = o);
									var _ = br(s, h), v = br(s, g);
									if (_ && v && (p.rangeCount !== 1 || p.anchorNode !== _.node || p.anchorOffset !== _.offset || p.focusNode !== v.node || p.focusOffset !== v.offset)) {
										var y = d.createRange();
										y.setStart(_.node, _.offset), p.removeAllRanges(), h > g ? (p.addRange(y), p.extend(v.node, v.offset)) : (y.setEnd(v.node, v.offset), p.addRange(y));
									}
								}
							}
						}
						for (d = [], p = s; p = p.parentNode;) p.nodeType === 1 && d.push({
							element: p,
							left: p.scrollLeft,
							top: p.scrollTop
						});
						for (typeof s.focus == "function" && s.focus(), s = 0; s < d.length; s++) {
							var b = d[s];
							b.element.scrollLeft = b.left, b.element.scrollTop = b.top;
						}
					}
					sp = !!Rd, zd = Rd = null;
				} finally {
					J = i, I.p = r, F.T = n;
				}
			}
			e.current = t, ru = 2;
		}
	}
	function Ru() {
		if (ru === 2) {
			ru = 0;
			var e = iu, t = au, n = (t.flags & 8772) != 0;
			if (t.subtreeFlags & 8772 || n) {
				n = F.T, F.T = null;
				var r = I.p;
				I.p = 2;
				var i = J;
				J |= 4;
				try {
					rl(e, t.alternate, t);
				} finally {
					J = i, I.p = r, F.T = n;
				}
			}
			ru = 3;
		}
	}
	function zu() {
		if (ru === 4 || ru === 3) {
			ru = 0, we();
			var e = iu, t = au, n = ou, r = lu;
			t.subtreeFlags & 10256 || t.flags & 10256 ? ru = 5 : (ru = 0, au = iu = null, Bu(e, e.pendingLanes));
			var i = e.pendingLanes;
			if (i === 0 && (nu = null), $e(n), t = t.stateNode, B && typeof B.onCommitFiberRoot == "function") try {
				B.onCommitFiberRoot(Ne, t, void 0, (t.current.flags & 128) == 128);
			} catch {}
			if (r !== null) {
				t = F.T, i = I.p, I.p = 2, F.T = null;
				try {
					for (var a = e.onRecoverableError, o = 0; o < r.length; o++) {
						var s = r[o];
						a(s.value, { componentStack: s.stack });
					}
				} finally {
					F.T = t, I.p = i;
				}
			}
			ou & 3 && Vu(), nd(e), i = e.pendingLanes, n & 261930 && i & 42 ? e === du ? uu++ : (uu = 0, du = e) : uu = 0, rd(0, !1);
		}
	}
	function Bu(e, t) {
		(e.pooledCacheLanes &= t) === 0 && (t = e.pooledCache, t != null && (e.pooledCache = null, na(t)));
	}
	function Vu() {
		return Lu(), Ru(), zu(), Hu();
	}
	function Hu() {
		if (ru !== 5) return !1;
		var e = iu, t = su;
		su = 0;
		var n = $e(ou), r = F.T, a = I.p;
		try {
			I.p = 32 > n ? 32 : n, F.T = null, n = cu, cu = null;
			var o = iu, s = ou;
			if (ru = 0, au = iu = null, ou = 0, J & 6) throw Error(i(331));
			var c = J;
			if (J |= 4, Ml(o.current), wl(o, o.current, s, n), J = c, rd(0, !1), B && typeof B.onPostCommitFiberRoot == "function") try {
				B.onPostCommitFiberRoot(Ne, o);
			} catch {}
			return !0;
		} finally {
			I.p = a, F.T = r, Bu(e, t);
		}
	}
	function Uu(e, t, n) {
		t = di(n, t), t = Js(e.stateNode, t, 2), e = La(e, t, 2), e !== null && (qe(e, 2), nd(e));
	}
	function Q(e, t, n) {
		if (e.tag === 3) Uu(e, e, n);
		else for (; t !== null;) {
			if (t.tag === 3) {
				Uu(t, e, n);
				break;
			} else if (t.tag === 1) {
				var r = t.stateNode;
				if (typeof t.type.getDerivedStateFromError == "function" || typeof r.componentDidCatch == "function" && (nu === null || !nu.has(r))) {
					e = di(n, e), n = Ys(2), r = La(t, n, 2), r !== null && (Xs(n, r, t, e), qe(r, 2), nd(r));
					break;
				}
			}
			t = t.return;
		}
	}
	function Wu(e, t, n) {
		var r = e.pingCache;
		if (r === null) {
			r = e.pingCache = new Il();
			var i = /* @__PURE__ */ new Set();
			r.set(t, i);
		} else i = r.get(t), i === void 0 && (i = /* @__PURE__ */ new Set(), r.set(t, i));
		i.has(n) || (Vl = !0, i.add(n), e = Gu.bind(null, e, t, n), t.then(e, e));
	}
	function Gu(e, t, n) {
		var r = e.pingCache;
		r !== null && r.delete(t), e.pingedLanes |= e.suspendedLanes & n, e.warmLanes &= ~n, Ll === e && (X & n) === n && (Ul === 4 || Ul === 3 && (X & 62914560) === X && 300 > z() - Ql ? !(J & 2) && xu(e, 0) : Kl |= n, Jl === X && (Jl = 0)), nd(e);
	}
	function Ku(e, t) {
		t === 0 && (t = Ge()), e = Xr(e, t), e !== null && (qe(e, t), nd(e));
	}
	function qu(e) {
		var t = e.memoizedState, n = 0;
		t !== null && (n = t.retryLane), Ku(e, n);
	}
	function Ju(e, t) {
		var n = 0;
		switch (e.tag) {
			case 31:
			case 13:
				var r = e.stateNode, a = e.memoizedState;
				a !== null && (n = a.retryLane);
				break;
			case 19:
				r = e.stateNode;
				break;
			case 22:
				r = e.stateNode._retryCache;
				break;
			default: throw Error(i(314));
		}
		r !== null && r.delete(t), Ku(e, n);
	}
	function Yu(e, t) {
		return xe(e, t);
	}
	var Xu = null, Zu = null, Qu = !1, $u = !1, ed = !1, td = 0;
	function nd(e) {
		e !== Zu && e.next === null && (Zu === null ? Xu = Zu = e : Zu = Zu.next = e), $u = !0, Qu || (Qu = !0, ld());
	}
	function rd(e, t) {
		if (!ed && $u) {
			ed = !0;
			do
				for (var n = !1, r = Xu; r !== null;) {
					if (!t) if (e !== 0) {
						var i = r.pendingLanes;
						if (i === 0) var a = 0;
						else {
							var o = r.suspendedLanes, s = r.pingedLanes;
							a = (1 << 31 - Fe(42 | e) + 1) - 1, a &= i & ~(o & ~s), a = a & 201326741 ? a & 201326741 | 1 : a ? a | 2 : 0;
						}
						a !== 0 && (n = !0, cd(r, a));
					} else a = X, a = V(r, r === Ll ? a : 0, r.cancelPendingCommit !== null || r.timeoutHandle !== -1), !(a & 3) || Ue(r, a) || (n = !0, cd(r, a));
					r = r.next;
				}
			while (n);
			ed = !1;
		}
	}
	function id() {
		ad();
	}
	function ad() {
		$u = Qu = !1;
		var e = 0;
		td !== 0 && Gd() && (e = td);
		for (var t = z(), n = null, r = Xu; r !== null;) {
			var i = r.next, a = od(r, t);
			a === 0 ? (r.next = null, n === null ? Xu = i : n.next = i, i === null && (Zu = n)) : (n = r, (e !== 0 || a & 3) && ($u = !0)), r = i;
		}
		ru !== 0 && ru !== 5 || rd(e, !1), td !== 0 && (td = 0);
	}
	function od(e, t) {
		for (var n = e.suspendedLanes, r = e.pingedLanes, i = e.expirationTimes, a = e.pendingLanes & -62914561; 0 < a;) {
			var o = 31 - Fe(a), s = 1 << o, c = i[o];
			c === -1 ? ((s & n) === 0 || (s & r) !== 0) && (i[o] = We(s, t)) : c <= t && (e.expiredLanes |= s), a &= ~s;
		}
		if (t = Ll, n = X, n = V(e, e === t ? n : 0, e.cancelPendingCommit !== null || e.timeoutHandle !== -1), r = e.callbackNode, n === 0 || e === t && (Z === 2 || Z === 9) || e.cancelPendingCommit !== null) return r !== null && r !== null && Se(r), e.callbackNode = null, e.callbackPriority = 0;
		if (!(n & 3) || Ue(e, n)) {
			if (t = n & -n, t === e.callbackPriority) return t;
			switch (r !== null && Se(r), $e(n)) {
				case 2:
				case 8:
					n = De;
					break;
				case 32:
					n = Oe;
					break;
				case 268435456:
					n = Ae;
					break;
				default: n = Oe;
			}
			return r = sd.bind(null, e), n = xe(n, r), e.callbackPriority = t, e.callbackNode = n, t;
		}
		return r !== null && r !== null && Se(r), e.callbackPriority = 2, e.callbackNode = null, 2;
	}
	function sd(e, t) {
		if (ru !== 0 && ru !== 5) return e.callbackNode = null, e.callbackPriority = 0, null;
		var n = e.callbackNode;
		if (Vu() && e.callbackNode !== n) return null;
		var r = X;
		return r = V(e, e === Ll ? r : 0, e.cancelPendingCommit !== null || e.timeoutHandle !== -1), r === 0 ? null : (hu(e, r, t), od(e, z()), e.callbackNode != null && e.callbackNode === n ? sd.bind(null, e) : null);
	}
	function cd(e, t) {
		if (Vu()) return null;
		hu(e, t, !0);
	}
	function ld() {
		Yd(function() {
			J & 6 ? xe(Ee, id) : ad();
		});
	}
	function ud() {
		if (td === 0) {
			var e = aa;
			e === 0 && (e = ze, ze <<= 1, !(ze & 261888) && (ze = 256)), td = e;
		}
		return td;
	}
	function dd(e) {
		return e == null || typeof e == "symbol" || typeof e == "boolean" ? null : typeof e == "function" ? e : qt("" + e);
	}
	function fd(e, t) {
		var n = t.ownerDocument.createElement("input");
		return n.name = t.name, n.value = t.value, e.id && n.setAttribute("form", e.id), t.parentNode.insertBefore(n, t), e = new FormData(e), n.parentNode.removeChild(n), e;
	}
	function pd(e, t, n, r, i) {
		if (t === "submit" && n && n.stateNode === i) {
			var a = dd((i[it] || null).action), o = r.submitter;
			o && (t = (t = o[it] || null) ? dd(t.formAction) : o.getAttribute("formAction"), t !== null && (a = t, o = null));
			var s = new gn("action", "action", null, r, i);
			e.push({
				event: s,
				listeners: [{
					instance: null,
					listener: function() {
						if (r.defaultPrevented) {
							if (td !== 0) {
								var e = o ? fd(i, o) : new FormData(i);
								bs(n, {
									pending: !0,
									data: e,
									method: i.method,
									action: a
								}, null, e);
							}
						} else typeof a == "function" && (s.preventDefault(), e = o ? fd(i, o) : new FormData(i), bs(n, {
							pending: !0,
							data: e,
							method: i.method,
							action: a
						}, a, e));
					},
					currentTarget: i
				}]
			});
		}
	}
	for (var md = 0; md < Vr.length; md++) {
		var hd = Vr[md];
		Hr(hd.toLowerCase(), "on" + (hd[0].toUpperCase() + hd.slice(1)));
	}
	Hr(Nr, "onAnimationEnd"), Hr(Pr, "onAnimationIteration"), Hr(Fr, "onAnimationStart"), Hr("dblclick", "onDoubleClick"), Hr("focusin", "onFocus"), Hr("focusout", "onBlur"), Hr(Ir, "onTransitionRun"), Hr(Lr, "onTransitionStart"), Hr(Rr, "onTransitionCancel"), Hr(zr, "onTransitionEnd"), vt("onMouseEnter", ["mouseout", "mouseover"]), vt("onMouseLeave", ["mouseout", "mouseover"]), vt("onPointerEnter", ["pointerout", "pointerover"]), vt("onPointerLeave", ["pointerout", "pointerover"]), _t("onChange", "change click focusin focusout input keydown keyup selectionchange".split(" ")), _t("onSelect", "focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(" ")), _t("onBeforeInput", [
		"compositionend",
		"keypress",
		"textInput",
		"paste"
	]), _t("onCompositionEnd", "compositionend focusout keydown keypress keyup mousedown".split(" ")), _t("onCompositionStart", "compositionstart focusout keydown keypress keyup mousedown".split(" ")), _t("onCompositionUpdate", "compositionupdate focusout keydown keypress keyup mousedown".split(" "));
	var gd = "abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(" "), _d = new Set("beforetoggle cancel close invalid load scroll scrollend toggle".split(" ").concat(gd));
	function vd(e, t) {
		t = (t & 4) != 0;
		for (var n = 0; n < e.length; n++) {
			var r = e[n], i = r.event;
			r = r.listeners;
			a: {
				var a = void 0;
				if (t) for (var o = r.length - 1; 0 <= o; o--) {
					var s = r[o], c = s.instance, l = s.currentTarget;
					if (s = s.listener, c !== a && i.isPropagationStopped()) break a;
					a = s, i.currentTarget = l;
					try {
						a(i);
					} catch (e) {
						Ur(e);
					}
					i.currentTarget = null, a = c;
				}
				else for (o = 0; o < r.length; o++) {
					if (s = r[o], c = s.instance, l = s.currentTarget, s = s.listener, c !== a && i.isPropagationStopped()) break a;
					a = s, i.currentTarget = l;
					try {
						a(i);
					} catch (e) {
						Ur(e);
					}
					i.currentTarget = null, a = c;
				}
			}
		}
	}
	function $(e, t) {
		var n = t[H];
		n === void 0 && (n = t[H] = /* @__PURE__ */ new Set());
		var r = e + "__bubble";
		n.has(r) || (Sd(t, e, 2, !1), n.add(r));
	}
	function yd(e, t, n) {
		var r = 0;
		t && (r |= 4), Sd(n, e, r, t);
	}
	var bd = "_reactListening" + Math.random().toString(36).slice(2);
	function xd(e) {
		if (!e[bd]) {
			e[bd] = !0, ht.forEach(function(t) {
				t !== "selectionchange" && (_d.has(t) || yd(t, !1, e), yd(t, !0, e));
			});
			var t = e.nodeType === 9 ? e : e.ownerDocument;
			t === null || t[bd] || (t[bd] = !0, yd("selectionchange", !1, t));
		}
	}
	function Sd(e, t, n, r) {
		switch (mp(t)) {
			case 2:
				var i = cp;
				break;
			case 8:
				i = lp;
				break;
			default: i = up;
		}
		n = i.bind(null, t, n, e), i = void 0, !an || t !== "touchstart" && t !== "touchmove" && t !== "wheel" || (i = !0), r ? i === void 0 ? e.addEventListener(t, n, !0) : e.addEventListener(t, n, {
			capture: !0,
			passive: i
		}) : i === void 0 ? e.addEventListener(t, n, !1) : e.addEventListener(t, n, { passive: i });
	}
	function Cd(e, t, n, r, i) {
		var a = r;
		if (!(t & 1) && !(t & 2) && r !== null) a: for (;;) {
			if (r === null) return;
			var s = r.tag;
			if (s === 3 || s === 4) {
				var c = r.stateNode.containerInfo;
				if (c === i) break;
				if (s === 4) for (s = r.return; s !== null;) {
					var l = s.tag;
					if ((l === 3 || l === 4) && s.stateNode.containerInfo === i) return;
					s = s.return;
				}
				for (; c !== null;) {
					if (s = ut(c), s === null) return;
					if (l = s.tag, l === 5 || l === 6 || l === 26 || l === 27) {
						r = a = s;
						continue a;
					}
					c = c.parentNode;
				}
			}
			r = r.return;
		}
		tn(function() {
			var r = a, i = Xt(n), s = [];
			a: {
				var c = Br.get(e);
				if (c !== void 0) {
					var l = gn, u = e;
					switch (e) {
						case "keypress": if (dn(n) === 0) break a;
						case "keydown":
						case "keyup":
							l = Pn;
							break;
						case "focusin":
							u = "focus", l = Tn;
							break;
						case "focusout":
							u = "blur", l = Tn;
							break;
						case "beforeblur":
						case "afterblur":
							l = Tn;
							break;
						case "click": if (n.button === 2) break a;
						case "auxclick":
						case "dblclick":
						case "mousedown":
						case "mousemove":
						case "mouseup":
						case "mouseout":
						case "mouseover":
						case "contextmenu":
							l = Cn;
							break;
						case "drag":
						case "dragend":
						case "dragenter":
						case "dragexit":
						case "dragleave":
						case "dragover":
						case "dragstart":
						case "drop":
							l = wn;
							break;
						case "touchcancel":
						case "touchend":
						case "touchmove":
						case "touchstart":
							l = In;
							break;
						case Nr:
						case Pr:
						case Fr:
							l = En;
							break;
						case zr:
							l = Ln;
							break;
						case "scroll":
						case "scrollend":
							l = vn;
							break;
						case "wheel":
							l = Rn;
							break;
						case "copy":
						case "cut":
						case "paste":
							l = Dn;
							break;
						case "gotpointercapture":
						case "lostpointercapture":
						case "pointercancel":
						case "pointerdown":
						case "pointermove":
						case "pointerout":
						case "pointerover":
						case "pointerup":
							l = Fn;
							break;
						case "toggle":
						case "beforetoggle": l = zn;
					}
					var d = (t & 4) != 0, f = !d && (e === "scroll" || e === "scrollend"), p = d ? c === null ? null : c + "Capture" : c;
					d = [];
					for (var m = r, h; m !== null;) {
						var g = m;
						if (h = g.stateNode, g = g.tag, g !== 5 && g !== 26 && g !== 27 || h === null || p === null || (g = nn(m, p), g != null && d.push(wd(m, g, h))), f) break;
						m = m.return;
					}
					0 < d.length && (c = new l(c, u, null, n, i), s.push({
						event: c,
						listeners: d
					}));
				}
			}
			if (!(t & 7)) {
				a: {
					if (c = e === "mouseover" || e === "pointerover", l = e === "mouseout" || e === "pointerout", c && n !== Yt && (u = n.relatedTarget || n.fromElement) && (ut(u) || u[at])) break a;
					if ((l || c) && (c = i.window === i ? i : (c = i.ownerDocument) ? c.defaultView || c.parentWindow : window, l ? (u = n.relatedTarget || n.toElement, l = r, u = u ? ut(u) : null, u !== null && (f = o(u), d = u.tag, u !== f || d !== 5 && d !== 27 && d !== 6) && (u = null)) : (l = null, u = r), l !== u)) {
						if (d = Cn, g = "onMouseLeave", p = "onMouseEnter", m = "mouse", (e === "pointerout" || e === "pointerover") && (d = Fn, g = "onPointerLeave", p = "onPointerEnter", m = "pointer"), f = l == null ? c : ft(l), h = u == null ? c : ft(u), c = new d(g, m + "leave", l, n, i), c.target = f, c.relatedTarget = h, g = null, ut(i) === r && (d = new d(p, m + "enter", u, n, i), d.target = h, d.relatedTarget = f, g = d), f = g, l && u) b: {
							for (d = Ed, p = l, m = u, h = 0, g = p; g; g = d(g)) h++;
							g = 0;
							for (var _ = m; _; _ = d(_)) g++;
							for (; 0 < h - g;) p = d(p), h--;
							for (; 0 < g - h;) m = d(m), g--;
							for (; h--;) {
								if (p === m || m !== null && p === m.alternate) {
									d = p;
									break b;
								}
								p = d(p), m = d(m);
							}
							d = null;
						}
						else d = null;
						l !== null && Dd(s, c, l, d, !1), u !== null && f !== null && Dd(s, f, u, d, !0);
					}
				}
				a: {
					if (c = r ? ft(r) : window, l = c.nodeName && c.nodeName.toLowerCase(), l === "select" || l === "input" && c.type === "file") var v = ar;
					else if ($n(c)) if (or) v = hr;
					else {
						v = pr;
						var y = fr;
					}
					else l = c.nodeName, !l || l.toLowerCase() !== "input" || c.type !== "checkbox" && c.type !== "radio" ? r && Wt(r.elementType) && (v = ar) : v = mr;
					if (v &&= v(e, r)) {
						er(s, v, n, i);
						break a;
					}
					y && y(e, c, r), e === "focusout" && r && c.type === "number" && r.memoizedProps.value != null && It(c, "number", c.value);
				}
				switch (y = r ? ft(r) : window, e) {
					case "focusin":
						($n(y) || y.contentEditable === "true") && (W = y, Tr = r, Er = null);
						break;
					case "focusout":
						Er = Tr = W = null;
						break;
					case "mousedown":
						Dr = !0;
						break;
					case "contextmenu":
					case "mouseup":
					case "dragend":
						Dr = !1, Or(s, n, i);
						break;
					case "selectionchange": if (wr) break;
					case "keydown":
					case "keyup": Or(s, n, i);
				}
				var b;
				if (Vn) b: {
					switch (e) {
						case "compositionstart":
							var x = "onCompositionStart";
							break b;
						case "compositionend":
							x = "onCompositionEnd";
							break b;
						case "compositionupdate":
							x = "onCompositionUpdate";
							break b;
					}
					x = void 0;
				}
				else Yn ? qn(e, n) && (x = "onCompositionEnd") : e === "keydown" && n.keyCode === 229 && (x = "onCompositionStart");
				x && (Wn && n.locale !== "ko" && (Yn || x !== "onCompositionStart" ? x === "onCompositionEnd" && Yn && (b = un()) : (sn = i, cn = "value" in sn ? sn.value : sn.textContent, Yn = !0)), y = Td(r, x), 0 < y.length && (x = new On(x, e, null, n, i), s.push({
					event: x,
					listeners: y
				}), b ? x.data = b : (b = Jn(n), b !== null && (x.data = b)))), (b = Un ? Xn(e, n) : Zn(e, n)) && (x = Td(r, "onBeforeInput"), 0 < x.length && (y = new On("onBeforeInput", "beforeinput", null, n, i), s.push({
					event: y,
					listeners: x
				}), y.data = b)), pd(s, e, r, n, i);
			}
			vd(s, t);
		});
	}
	function wd(e, t, n) {
		return {
			instance: e,
			listener: t,
			currentTarget: n
		};
	}
	function Td(e, t) {
		for (var n = t + "Capture", r = []; e !== null;) {
			var i = e, a = i.stateNode;
			if (i = i.tag, i !== 5 && i !== 26 && i !== 27 || a === null || (i = nn(e, n), i != null && r.unshift(wd(e, i, a)), i = nn(e, t), i != null && r.push(wd(e, i, a))), e.tag === 3) return r;
			e = e.return;
		}
		return [];
	}
	function Ed(e) {
		if (e === null) return null;
		do
			e = e.return;
		while (e && e.tag !== 5 && e.tag !== 27);
		return e || null;
	}
	function Dd(e, t, n, r, i) {
		for (var a = t._reactName, o = []; n !== null && n !== r;) {
			var s = n, c = s.alternate, l = s.stateNode;
			if (s = s.tag, c !== null && c === r) break;
			s !== 5 && s !== 26 && s !== 27 || l === null || (c = l, i ? (l = nn(n, a), l != null && o.unshift(wd(n, l, c))) : i || (l = nn(n, a), l != null && o.push(wd(n, l, c)))), n = n.return;
		}
		o.length !== 0 && e.push({
			event: t,
			listeners: o
		});
	}
	var Od = /\r\n?/g, kd = /\u0000|\uFFFD/g;
	function Ad(e) {
		return (typeof e == "string" ? e : "" + e).replace(Od, "\n").replace(kd, "");
	}
	function jd(e, t) {
		return t = Ad(t), Ad(e) === t;
	}
	function Md(e, t, n, r, a, o) {
		switch (n) {
			case "children":
				typeof r == "string" ? t === "body" || t === "textarea" && r === "" || Bt(e, r) : (typeof r == "number" || typeof r == "bigint") && t !== "body" && Bt(e, "" + r);
				break;
			case "className":
				wt(e, "class", r);
				break;
			case "tabIndex":
				wt(e, "tabindex", r);
				break;
			case "dir":
			case "role":
			case "viewBox":
			case "width":
			case "height":
				wt(e, n, r);
				break;
			case "style":
				Ut(e, r, o);
				break;
			case "data": if (t !== "object") {
				wt(e, "data", r);
				break;
			}
			case "src":
			case "href":
				if (r === "" && (t !== "a" || n !== "href")) {
					e.removeAttribute(n);
					break;
				}
				if (r == null || typeof r == "function" || typeof r == "symbol" || typeof r == "boolean") {
					e.removeAttribute(n);
					break;
				}
				r = qt("" + r), e.setAttribute(n, r);
				break;
			case "action":
			case "formAction":
				if (typeof r == "function") {
					e.setAttribute(n, "javascript:throw new Error('A React form was unexpectedly submitted. If you called form.submit() manually, consider using form.requestSubmit() instead. If you\\'re trying to use event.stopPropagation() in a submit event handler, consider also calling event.preventDefault().')");
					break;
				} else typeof o == "function" && (n === "formAction" ? (t !== "input" && Md(e, t, "name", a.name, a, null), Md(e, t, "formEncType", a.formEncType, a, null), Md(e, t, "formMethod", a.formMethod, a, null), Md(e, t, "formTarget", a.formTarget, a, null)) : (Md(e, t, "encType", a.encType, a, null), Md(e, t, "method", a.method, a, null), Md(e, t, "target", a.target, a, null)));
				if (r == null || typeof r == "symbol" || typeof r == "boolean") {
					e.removeAttribute(n);
					break;
				}
				r = qt("" + r), e.setAttribute(n, r);
				break;
			case "onClick":
				r != null && (e.onclick = Jt);
				break;
			case "onScroll":
				r != null && $("scroll", e);
				break;
			case "onScrollEnd":
				r != null && $("scrollend", e);
				break;
			case "dangerouslySetInnerHTML":
				if (r != null) {
					if (typeof r != "object" || !("__html" in r)) throw Error(i(61));
					if (n = r.__html, n != null) {
						if (a.children != null) throw Error(i(60));
						e.innerHTML = n;
					}
				}
				break;
			case "multiple":
				e.multiple = r && typeof r != "function" && typeof r != "symbol";
				break;
			case "muted":
				e.muted = r && typeof r != "function" && typeof r != "symbol";
				break;
			case "suppressContentEditableWarning":
			case "suppressHydrationWarning":
			case "defaultValue":
			case "defaultChecked":
			case "innerHTML":
			case "ref": break;
			case "autoFocus": break;
			case "xlinkHref":
				if (r == null || typeof r == "function" || typeof r == "boolean" || typeof r == "symbol") {
					e.removeAttribute("xlink:href");
					break;
				}
				n = qt("" + r), e.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", n);
				break;
			case "contentEditable":
			case "spellCheck":
			case "draggable":
			case "value":
			case "autoReverse":
			case "externalResourcesRequired":
			case "focusable":
			case "preserveAlpha":
				r != null && typeof r != "function" && typeof r != "symbol" ? e.setAttribute(n, "" + r) : e.removeAttribute(n);
				break;
			case "inert":
			case "allowFullScreen":
			case "async":
			case "autoPlay":
			case "controls":
			case "default":
			case "defer":
			case "disabled":
			case "disablePictureInPicture":
			case "disableRemotePlayback":
			case "formNoValidate":
			case "hidden":
			case "loop":
			case "noModule":
			case "noValidate":
			case "open":
			case "playsInline":
			case "readOnly":
			case "required":
			case "reversed":
			case "scoped":
			case "seamless":
			case "itemScope":
				r && typeof r != "function" && typeof r != "symbol" ? e.setAttribute(n, "") : e.removeAttribute(n);
				break;
			case "capture":
			case "download":
				!0 === r ? e.setAttribute(n, "") : !1 !== r && r != null && typeof r != "function" && typeof r != "symbol" ? e.setAttribute(n, r) : e.removeAttribute(n);
				break;
			case "cols":
			case "rows":
			case "size":
			case "span":
				r != null && typeof r != "function" && typeof r != "symbol" && !isNaN(r) && 1 <= r ? e.setAttribute(n, r) : e.removeAttribute(n);
				break;
			case "rowSpan":
			case "start":
				r == null || typeof r == "function" || typeof r == "symbol" || isNaN(r) ? e.removeAttribute(n) : e.setAttribute(n, r);
				break;
			case "popover":
				$("beforetoggle", e), $("toggle", e), Ct(e, "popover", r);
				break;
			case "xlinkActuate":
				Tt(e, "http://www.w3.org/1999/xlink", "xlink:actuate", r);
				break;
			case "xlinkArcrole":
				Tt(e, "http://www.w3.org/1999/xlink", "xlink:arcrole", r);
				break;
			case "xlinkRole":
				Tt(e, "http://www.w3.org/1999/xlink", "xlink:role", r);
				break;
			case "xlinkShow":
				Tt(e, "http://www.w3.org/1999/xlink", "xlink:show", r);
				break;
			case "xlinkTitle":
				Tt(e, "http://www.w3.org/1999/xlink", "xlink:title", r);
				break;
			case "xlinkType":
				Tt(e, "http://www.w3.org/1999/xlink", "xlink:type", r);
				break;
			case "xmlBase":
				Tt(e, "http://www.w3.org/XML/1998/namespace", "xml:base", r);
				break;
			case "xmlLang":
				Tt(e, "http://www.w3.org/XML/1998/namespace", "xml:lang", r);
				break;
			case "xmlSpace":
				Tt(e, "http://www.w3.org/XML/1998/namespace", "xml:space", r);
				break;
			case "is":
				Ct(e, "is", r);
				break;
			case "innerText":
			case "textContent": break;
			default: (!(2 < n.length) || n[0] !== "o" && n[0] !== "O" || n[1] !== "n" && n[1] !== "N") && (n = Gt.get(n) || n, Ct(e, n, r));
		}
	}
	function Nd(e, t, n, r, a, o) {
		switch (n) {
			case "style":
				Ut(e, r, o);
				break;
			case "dangerouslySetInnerHTML":
				if (r != null) {
					if (typeof r != "object" || !("__html" in r)) throw Error(i(61));
					if (n = r.__html, n != null) {
						if (a.children != null) throw Error(i(60));
						e.innerHTML = n;
					}
				}
				break;
			case "children":
				typeof r == "string" ? Bt(e, r) : (typeof r == "number" || typeof r == "bigint") && Bt(e, "" + r);
				break;
			case "onScroll":
				r != null && $("scroll", e);
				break;
			case "onScrollEnd":
				r != null && $("scrollend", e);
				break;
			case "onClick":
				r != null && (e.onclick = Jt);
				break;
			case "suppressContentEditableWarning":
			case "suppressHydrationWarning":
			case "innerHTML":
			case "ref": break;
			case "innerText":
			case "textContent": break;
			default: if (!gt.hasOwnProperty(n)) a: {
				if (n[0] === "o" && n[1] === "n" && (a = n.endsWith("Capture"), t = n.slice(2, a ? n.length - 7 : void 0), o = e[it] || null, o = o == null ? null : o[n], typeof o == "function" && e.removeEventListener(t, o, a), typeof r == "function")) {
					typeof o != "function" && o !== null && (n in e ? e[n] = null : e.hasAttribute(n) && e.removeAttribute(n)), e.addEventListener(t, r, a);
					break a;
				}
				n in e ? e[n] = r : !0 === r ? e.setAttribute(n, "") : Ct(e, n, r);
			}
		}
	}
	function Pd(e, t, n) {
		switch (t) {
			case "div":
			case "span":
			case "svg":
			case "path":
			case "a":
			case "g":
			case "p":
			case "li": break;
			case "img":
				$("error", e), $("load", e);
				var r = !1, a = !1, o;
				for (o in n) if (n.hasOwnProperty(o)) {
					var s = n[o];
					if (s != null) switch (o) {
						case "src":
							r = !0;
							break;
						case "srcSet":
							a = !0;
							break;
						case "children":
						case "dangerouslySetInnerHTML": throw Error(i(137, t));
						default: Md(e, t, o, s, n, null);
					}
				}
				a && Md(e, t, "srcSet", n.srcSet, n, null), r && Md(e, t, "src", n.src, n, null);
				return;
			case "input":
				$("invalid", e);
				var c = o = s = a = null, l = null, u = null;
				for (r in n) if (n.hasOwnProperty(r)) {
					var d = n[r];
					if (d != null) switch (r) {
						case "name":
							a = d;
							break;
						case "type":
							s = d;
							break;
						case "checked":
							l = d;
							break;
						case "defaultChecked":
							u = d;
							break;
						case "value":
							o = d;
							break;
						case "defaultValue":
							c = d;
							break;
						case "children":
						case "dangerouslySetInnerHTML":
							if (d != null) throw Error(i(137, t));
							break;
						default: Md(e, t, r, d, n, null);
					}
				}
				Ft(e, o, c, l, u, s, a, !1);
				return;
			case "select":
				for (a in $("invalid", e), r = s = o = null, n) if (n.hasOwnProperty(a) && (c = n[a], c != null)) switch (a) {
					case "value":
						o = c;
						break;
					case "defaultValue":
						s = c;
						break;
					case "multiple": r = c;
					default: Md(e, t, a, c, n, null);
				}
				t = o, n = s, e.multiple = !!r, t == null ? n != null && Lt(e, !!r, n, !0) : Lt(e, !!r, t, !1);
				return;
			case "textarea":
				for (s in $("invalid", e), o = a = r = null, n) if (n.hasOwnProperty(s) && (c = n[s], c != null)) switch (s) {
					case "value":
						r = c;
						break;
					case "defaultValue":
						a = c;
						break;
					case "children":
						o = c;
						break;
					case "dangerouslySetInnerHTML":
						if (c != null) throw Error(i(91));
						break;
					default: Md(e, t, s, c, n, null);
				}
				zt(e, r, a, o);
				return;
			case "option":
				for (l in n) if (n.hasOwnProperty(l) && (r = n[l], r != null)) switch (l) {
					case "selected":
						e.selected = r && typeof r != "function" && typeof r != "symbol";
						break;
					default: Md(e, t, l, r, n, null);
				}
				return;
			case "dialog":
				$("beforetoggle", e), $("toggle", e), $("cancel", e), $("close", e);
				break;
			case "iframe":
			case "object":
				$("load", e);
				break;
			case "video":
			case "audio":
				for (r = 0; r < gd.length; r++) $(gd[r], e);
				break;
			case "image":
				$("error", e), $("load", e);
				break;
			case "details":
				$("toggle", e);
				break;
			case "embed":
			case "source":
			case "link": $("error", e), $("load", e);
			case "area":
			case "base":
			case "br":
			case "col":
			case "hr":
			case "keygen":
			case "meta":
			case "param":
			case "track":
			case "wbr":
			case "menuitem":
				for (u in n) if (n.hasOwnProperty(u) && (r = n[u], r != null)) switch (u) {
					case "children":
					case "dangerouslySetInnerHTML": throw Error(i(137, t));
					default: Md(e, t, u, r, n, null);
				}
				return;
			default: if (Wt(t)) {
				for (d in n) n.hasOwnProperty(d) && (r = n[d], r !== void 0 && Nd(e, t, d, r, n, void 0));
				return;
			}
		}
		for (c in n) n.hasOwnProperty(c) && (r = n[c], r != null && Md(e, t, c, r, n, null));
	}
	function Fd(e, t, n, r) {
		switch (t) {
			case "div":
			case "span":
			case "svg":
			case "path":
			case "a":
			case "g":
			case "p":
			case "li": break;
			case "input":
				var a = null, o = null, s = null, c = null, l = null, u = null, d = null;
				for (m in n) {
					var f = n[m];
					if (n.hasOwnProperty(m) && f != null) switch (m) {
						case "checked": break;
						case "value": break;
						case "defaultValue": l = f;
						default: r.hasOwnProperty(m) || Md(e, t, m, null, r, f);
					}
				}
				for (var p in r) {
					var m = r[p];
					if (f = n[p], r.hasOwnProperty(p) && (m != null || f != null)) switch (p) {
						case "type":
							o = m;
							break;
						case "name":
							a = m;
							break;
						case "checked":
							u = m;
							break;
						case "defaultChecked":
							d = m;
							break;
						case "value":
							s = m;
							break;
						case "defaultValue":
							c = m;
							break;
						case "children":
						case "dangerouslySetInnerHTML":
							if (m != null) throw Error(i(137, t));
							break;
						default: m !== f && Md(e, t, p, m, r, f);
					}
				}
				Pt(e, s, c, l, u, d, o, a);
				return;
			case "select":
				for (o in m = s = c = p = null, n) if (l = n[o], n.hasOwnProperty(o) && l != null) switch (o) {
					case "value": break;
					case "multiple": m = l;
					default: r.hasOwnProperty(o) || Md(e, t, o, null, r, l);
				}
				for (a in r) if (o = r[a], l = n[a], r.hasOwnProperty(a) && (o != null || l != null)) switch (a) {
					case "value":
						p = o;
						break;
					case "defaultValue":
						c = o;
						break;
					case "multiple": s = o;
					default: o !== l && Md(e, t, a, o, r, l);
				}
				t = c, n = s, r = m, p == null ? !!r != !!n && (t == null ? Lt(e, !!n, n ? [] : "", !1) : Lt(e, !!n, t, !0)) : Lt(e, !!n, p, !1);
				return;
			case "textarea":
				for (c in m = p = null, n) if (a = n[c], n.hasOwnProperty(c) && a != null && !r.hasOwnProperty(c)) switch (c) {
					case "value": break;
					case "children": break;
					default: Md(e, t, c, null, r, a);
				}
				for (s in r) if (a = r[s], o = n[s], r.hasOwnProperty(s) && (a != null || o != null)) switch (s) {
					case "value":
						p = a;
						break;
					case "defaultValue":
						m = a;
						break;
					case "children": break;
					case "dangerouslySetInnerHTML":
						if (a != null) throw Error(i(91));
						break;
					default: a !== o && Md(e, t, s, a, r, o);
				}
				Rt(e, p, m);
				return;
			case "option":
				for (var h in n) if (p = n[h], n.hasOwnProperty(h) && p != null && !r.hasOwnProperty(h)) switch (h) {
					case "selected":
						e.selected = !1;
						break;
					default: Md(e, t, h, null, r, p);
				}
				for (l in r) if (p = r[l], m = n[l], r.hasOwnProperty(l) && p !== m && (p != null || m != null)) switch (l) {
					case "selected":
						e.selected = p && typeof p != "function" && typeof p != "symbol";
						break;
					default: Md(e, t, l, p, r, m);
				}
				return;
			case "img":
			case "link":
			case "area":
			case "base":
			case "br":
			case "col":
			case "embed":
			case "hr":
			case "keygen":
			case "meta":
			case "param":
			case "source":
			case "track":
			case "wbr":
			case "menuitem":
				for (var g in n) p = n[g], n.hasOwnProperty(g) && p != null && !r.hasOwnProperty(g) && Md(e, t, g, null, r, p);
				for (u in r) if (p = r[u], m = n[u], r.hasOwnProperty(u) && p !== m && (p != null || m != null)) switch (u) {
					case "children":
					case "dangerouslySetInnerHTML":
						if (p != null) throw Error(i(137, t));
						break;
					default: Md(e, t, u, p, r, m);
				}
				return;
			default: if (Wt(t)) {
				for (var _ in n) p = n[_], n.hasOwnProperty(_) && p !== void 0 && !r.hasOwnProperty(_) && Nd(e, t, _, void 0, r, p);
				for (d in r) p = r[d], m = n[d], !r.hasOwnProperty(d) || p === m || p === void 0 && m === void 0 || Nd(e, t, d, p, r, m);
				return;
			}
		}
		for (var v in n) p = n[v], n.hasOwnProperty(v) && p != null && !r.hasOwnProperty(v) && Md(e, t, v, null, r, p);
		for (f in r) p = r[f], m = n[f], !r.hasOwnProperty(f) || p === m || p == null && m == null || Md(e, t, f, p, r, m);
	}
	function Id(e) {
		switch (e) {
			case "css":
			case "script":
			case "font":
			case "img":
			case "image":
			case "input":
			case "link": return !0;
			default: return !1;
		}
	}
	function Ld() {
		if (typeof performance.getEntriesByType == "function") {
			for (var e = 0, t = 0, n = performance.getEntriesByType("resource"), r = 0; r < n.length; r++) {
				var i = n[r], a = i.transferSize, o = i.initiatorType, s = i.duration;
				if (a && s && Id(o)) {
					for (o = 0, s = i.responseEnd, r += 1; r < n.length; r++) {
						var c = n[r], l = c.startTime;
						if (l > s) break;
						var u = c.transferSize, d = c.initiatorType;
						u && Id(d) && (c = c.responseEnd, o += u * (c < s ? 1 : (s - l) / (c - l)));
					}
					if (--r, t += 8 * (a + o) / (i.duration / 1e3), e++, 10 < e) break;
				}
			}
			if (0 < e) return t / e / 1e6;
		}
		return navigator.connection && (e = navigator.connection.downlink, typeof e == "number") ? e : 5;
	}
	var Rd = null, zd = null;
	function Bd(e) {
		return e.nodeType === 9 ? e : e.ownerDocument;
	}
	function Vd(e) {
		switch (e) {
			case "http://www.w3.org/2000/svg": return 1;
			case "http://www.w3.org/1998/Math/MathML": return 2;
			default: return 0;
		}
	}
	function Hd(e, t) {
		if (e === 0) switch (t) {
			case "svg": return 1;
			case "math": return 2;
			default: return 0;
		}
		return e === 1 && t === "foreignObject" ? 0 : e;
	}
	function Ud(e, t) {
		return e === "textarea" || e === "noscript" || typeof t.children == "string" || typeof t.children == "number" || typeof t.children == "bigint" || typeof t.dangerouslySetInnerHTML == "object" && t.dangerouslySetInnerHTML !== null && t.dangerouslySetInnerHTML.__html != null;
	}
	var Wd = null;
	function Gd() {
		var e = window.event;
		return e && e.type === "popstate" ? e === Wd ? !1 : (Wd = e, !0) : (Wd = null, !1);
	}
	var Kd = typeof setTimeout == "function" ? setTimeout : void 0, qd = typeof clearTimeout == "function" ? clearTimeout : void 0, Jd = typeof Promise == "function" ? Promise : void 0, Yd = typeof queueMicrotask == "function" ? queueMicrotask : Jd === void 0 ? Kd : function(e) {
		return Jd.resolve(null).then(e).catch(Xd);
	};
	function Xd(e) {
		setTimeout(function() {
			throw e;
		});
	}
	function Zd(e) {
		return e === "head";
	}
	function Qd(e, t) {
		var n = t, r = 0;
		do {
			var i = n.nextSibling;
			if (e.removeChild(n), i && i.nodeType === 8) if (n = i.data, n === "/$" || n === "/&") {
				if (r === 0) {
					e.removeChild(i), Np(t);
					return;
				}
				r--;
			} else if (n === "$" || n === "$?" || n === "$~" || n === "$!" || n === "&") r++;
			else if (n === "html") pf(e.ownerDocument.documentElement);
			else if (n === "head") {
				n = e.ownerDocument.head, pf(n);
				for (var a = n.firstChild; a;) {
					var o = a.nextSibling, s = a.nodeName;
					a[ct] || s === "SCRIPT" || s === "STYLE" || s === "LINK" && a.rel.toLowerCase() === "stylesheet" || n.removeChild(a), a = o;
				}
			} else n === "body" && pf(e.ownerDocument.body);
			n = i;
		} while (n);
		Np(t);
	}
	function $d(e, t) {
		var n = e;
		e = 0;
		do {
			var r = n.nextSibling;
			if (n.nodeType === 1 ? t ? (n._stashedDisplay = n.style.display, n.style.display = "none") : (n.style.display = n._stashedDisplay || "", n.getAttribute("style") === "" && n.removeAttribute("style")) : n.nodeType === 3 && (t ? (n._stashedText = n.nodeValue, n.nodeValue = "") : n.nodeValue = n._stashedText || ""), r && r.nodeType === 8) if (n = r.data, n === "/$") {
				if (e === 0) break;
				e--;
			} else n !== "$" && n !== "$?" && n !== "$~" && n !== "$!" || e++;
			n = r;
		} while (n);
	}
	function ef(e) {
		var t = e.firstChild;
		for (t && t.nodeType === 10 && (t = t.nextSibling); t;) {
			var n = t;
			switch (t = t.nextSibling, n.nodeName) {
				case "HTML":
				case "HEAD":
				case "BODY":
					ef(n), lt(n);
					continue;
				case "SCRIPT":
				case "STYLE": continue;
				case "LINK": if (n.rel.toLowerCase() === "stylesheet") continue;
			}
			e.removeChild(n);
		}
	}
	function tf(e, t, n, r) {
		for (; e.nodeType === 1;) {
			var i = n;
			if (e.nodeName.toLowerCase() !== t.toLowerCase()) {
				if (!r && (e.nodeName !== "INPUT" || e.type !== "hidden")) break;
			} else if (!r) if (t === "input" && e.type === "hidden") {
				var a = i.name == null ? null : "" + i.name;
				if (i.type === "hidden" && e.getAttribute("name") === a) return e;
			} else return e;
			else if (!e[ct]) switch (t) {
				case "meta":
					if (!e.hasAttribute("itemprop")) break;
					return e;
				case "link":
					if (a = e.getAttribute("rel"), a === "stylesheet" && e.hasAttribute("data-precedence") || a !== i.rel || e.getAttribute("href") !== (i.href == null || i.href === "" ? null : i.href) || e.getAttribute("crossorigin") !== (i.crossOrigin == null ? null : i.crossOrigin) || e.getAttribute("title") !== (i.title == null ? null : i.title)) break;
					return e;
				case "style":
					if (e.hasAttribute("data-precedence")) break;
					return e;
				case "script":
					if (a = e.getAttribute("src"), (a !== (i.src == null ? null : i.src) || e.getAttribute("type") !== (i.type == null ? null : i.type) || e.getAttribute("crossorigin") !== (i.crossOrigin == null ? null : i.crossOrigin)) && a && e.hasAttribute("async") && !e.hasAttribute("itemprop")) break;
					return e;
				default: return e;
			}
			if (e = cf(e.nextSibling), e === null) break;
		}
		return null;
	}
	function nf(e, t, n) {
		if (t === "") return null;
		for (; e.nodeType !== 3;) if ((e.nodeType !== 1 || e.nodeName !== "INPUT" || e.type !== "hidden") && !n || (e = cf(e.nextSibling), e === null)) return null;
		return e;
	}
	function rf(e, t) {
		for (; e.nodeType !== 8;) if ((e.nodeType !== 1 || e.nodeName !== "INPUT" || e.type !== "hidden") && !t || (e = cf(e.nextSibling), e === null)) return null;
		return e;
	}
	function af(e) {
		return e.data === "$?" || e.data === "$~";
	}
	function of(e) {
		return e.data === "$!" || e.data === "$?" && e.ownerDocument.readyState !== "loading";
	}
	function sf(e, t) {
		var n = e.ownerDocument;
		if (e.data === "$~") e._reactRetry = t;
		else if (e.data !== "$?" || n.readyState !== "loading") t();
		else {
			var r = function() {
				t(), n.removeEventListener("DOMContentLoaded", r);
			};
			n.addEventListener("DOMContentLoaded", r), e._reactRetry = r;
		}
	}
	function cf(e) {
		for (; e != null; e = e.nextSibling) {
			var t = e.nodeType;
			if (t === 1 || t === 3) break;
			if (t === 8) {
				if (t = e.data, t === "$" || t === "$!" || t === "$?" || t === "$~" || t === "&" || t === "F!" || t === "F") break;
				if (t === "/$" || t === "/&") return null;
			}
		}
		return e;
	}
	var lf = null;
	function uf(e) {
		e = e.nextSibling;
		for (var t = 0; e;) {
			if (e.nodeType === 8) {
				var n = e.data;
				if (n === "/$" || n === "/&") {
					if (t === 0) return cf(e.nextSibling);
					t--;
				} else n !== "$" && n !== "$!" && n !== "$?" && n !== "$~" && n !== "&" || t++;
			}
			e = e.nextSibling;
		}
		return null;
	}
	function df(e) {
		e = e.previousSibling;
		for (var t = 0; e;) {
			if (e.nodeType === 8) {
				var n = e.data;
				if (n === "$" || n === "$!" || n === "$?" || n === "$~" || n === "&") {
					if (t === 0) return e;
					t--;
				} else n !== "/$" && n !== "/&" || t++;
			}
			e = e.previousSibling;
		}
		return null;
	}
	function ff(e, t, n) {
		switch (t = Bd(n), e) {
			case "html":
				if (e = t.documentElement, !e) throw Error(i(452));
				return e;
			case "head":
				if (e = t.head, !e) throw Error(i(453));
				return e;
			case "body":
				if (e = t.body, !e) throw Error(i(454));
				return e;
			default: throw Error(i(451));
		}
	}
	function pf(e) {
		for (var t = e.attributes; t.length;) e.removeAttributeNode(t[0]);
		lt(e);
	}
	var mf = /* @__PURE__ */ new Map(), hf = /* @__PURE__ */ new Set();
	function gf(e) {
		return typeof e.getRootNode == "function" ? e.getRootNode() : e.nodeType === 9 ? e : e.ownerDocument;
	}
	var _f = I.d;
	I.d = {
		f: vf,
		r: yf,
		D: Sf,
		C: Cf,
		L: wf,
		m: Tf,
		X: Df,
		S: Ef,
		M: Of
	};
	function vf() {
		var e = _f.f(), t = yu();
		return e || t;
	}
	function yf(e) {
		var t = dt(e);
		t !== null && t.tag === 5 && t.type === "form" ? Ss(t) : _f.r(e);
	}
	var bf = typeof document > "u" ? null : document;
	function xf(e, t, n) {
		var r = bf;
		if (r && typeof t == "string" && t) {
			var i = Nt(t);
			i = "link[rel=\"" + e + "\"][href=\"" + i + "\"]", typeof n == "string" && (i += "[crossorigin=\"" + n + "\"]"), hf.has(i) || (hf.add(i), e = {
				rel: e,
				crossOrigin: n,
				href: t
			}, r.querySelector(i) === null && (t = r.createElement("link"), Pd(t, "link", e), mt(t), r.head.appendChild(t)));
		}
	}
	function Sf(e) {
		_f.D(e), xf("dns-prefetch", e, null);
	}
	function Cf(e, t) {
		_f.C(e, t), xf("preconnect", e, t);
	}
	function wf(e, t, n) {
		_f.L(e, t, n);
		var r = bf;
		if (r && e && t) {
			var i = "link[rel=\"preload\"][as=\"" + Nt(t) + "\"]";
			t === "image" && n && n.imageSrcSet ? (i += "[imagesrcset=\"" + Nt(n.imageSrcSet) + "\"]", typeof n.imageSizes == "string" && (i += "[imagesizes=\"" + Nt(n.imageSizes) + "\"]")) : i += "[href=\"" + Nt(e) + "\"]";
			var a = i;
			switch (t) {
				case "style":
					a = Af(e);
					break;
				case "script": a = Pf(e);
			}
			mf.has(a) || (e = h({
				rel: "preload",
				href: t === "image" && n && n.imageSrcSet ? void 0 : e,
				as: t
			}, n), mf.set(a, e), r.querySelector(i) !== null || t === "style" && r.querySelector(jf(a)) || t === "script" && r.querySelector(Ff(a)) || (t = r.createElement("link"), Pd(t, "link", e), mt(t), r.head.appendChild(t)));
		}
	}
	function Tf(e, t) {
		_f.m(e, t);
		var n = bf;
		if (n && e) {
			var r = t && typeof t.as == "string" ? t.as : "script", i = "link[rel=\"modulepreload\"][as=\"" + Nt(r) + "\"][href=\"" + Nt(e) + "\"]", a = i;
			switch (r) {
				case "audioworklet":
				case "paintworklet":
				case "serviceworker":
				case "sharedworker":
				case "worker":
				case "script": a = Pf(e);
			}
			if (!mf.has(a) && (e = h({
				rel: "modulepreload",
				href: e
			}, t), mf.set(a, e), n.querySelector(i) === null)) {
				switch (r) {
					case "audioworklet":
					case "paintworklet":
					case "serviceworker":
					case "sharedworker":
					case "worker":
					case "script": if (n.querySelector(Ff(a))) return;
				}
				r = n.createElement("link"), Pd(r, "link", e), mt(r), n.head.appendChild(r);
			}
		}
	}
	function Ef(e, t, n) {
		_f.S(e, t, n);
		var r = bf;
		if (r && e) {
			var i = pt(r).hoistableStyles, a = Af(e);
			t ||= "default";
			var o = i.get(a);
			if (!o) {
				var s = {
					loading: 0,
					preload: null
				};
				if (o = r.querySelector(jf(a))) s.loading = 5;
				else {
					e = h({
						rel: "stylesheet",
						href: e,
						"data-precedence": t
					}, n), (n = mf.get(a)) && Rf(e, n);
					var c = o = r.createElement("link");
					mt(c), Pd(c, "link", e), c._p = new Promise(function(e, t) {
						c.onload = e, c.onerror = t;
					}), c.addEventListener("load", function() {
						s.loading |= 1;
					}), c.addEventListener("error", function() {
						s.loading |= 2;
					}), s.loading |= 4, Lf(o, t, r);
				}
				o = {
					type: "stylesheet",
					instance: o,
					count: 1,
					state: s
				}, i.set(a, o);
			}
		}
	}
	function Df(e, t) {
		_f.X(e, t);
		var n = bf;
		if (n && e) {
			var r = pt(n).hoistableScripts, i = Pf(e), a = r.get(i);
			a || (a = n.querySelector(Ff(i)), a || (e = h({
				src: e,
				async: !0
			}, t), (t = mf.get(i)) && zf(e, t), a = n.createElement("script"), mt(a), Pd(a, "link", e), n.head.appendChild(a)), a = {
				type: "script",
				instance: a,
				count: 1,
				state: null
			}, r.set(i, a));
		}
	}
	function Of(e, t) {
		_f.M(e, t);
		var n = bf;
		if (n && e) {
			var r = pt(n).hoistableScripts, i = Pf(e), a = r.get(i);
			a || (a = n.querySelector(Ff(i)), a || (e = h({
				src: e,
				async: !0,
				type: "module"
			}, t), (t = mf.get(i)) && zf(e, t), a = n.createElement("script"), mt(a), Pd(a, "link", e), n.head.appendChild(a)), a = {
				type: "script",
				instance: a,
				count: 1,
				state: null
			}, r.set(i, a));
		}
	}
	function kf(e, t, n, r) {
		var a = (a = se.current) ? gf(a) : null;
		if (!a) throw Error(i(446));
		switch (e) {
			case "meta":
			case "title": return null;
			case "style": return typeof n.precedence == "string" && typeof n.href == "string" ? (t = Af(n.href), n = pt(a).hoistableStyles, r = n.get(t), r || (r = {
				type: "style",
				instance: null,
				count: 0,
				state: null
			}, n.set(t, r)), r) : {
				type: "void",
				instance: null,
				count: 0,
				state: null
			};
			case "link":
				if (n.rel === "stylesheet" && typeof n.href == "string" && typeof n.precedence == "string") {
					e = Af(n.href);
					var o = pt(a).hoistableStyles, s = o.get(e);
					if (s || (a = a.ownerDocument || a, s = {
						type: "stylesheet",
						instance: null,
						count: 0,
						state: {
							loading: 0,
							preload: null
						}
					}, o.set(e, s), (o = a.querySelector(jf(e))) && !o._p && (s.instance = o, s.state.loading = 5), mf.has(e) || (n = {
						rel: "preload",
						as: "style",
						href: n.href,
						crossOrigin: n.crossOrigin,
						integrity: n.integrity,
						media: n.media,
						hrefLang: n.hrefLang,
						referrerPolicy: n.referrerPolicy
					}, mf.set(e, n), o || Nf(a, e, n, s.state))), t && r === null) throw Error(i(528, ""));
					return s;
				}
				if (t && r !== null) throw Error(i(529, ""));
				return null;
			case "script": return t = n.async, n = n.src, typeof n == "string" && t && typeof t != "function" && typeof t != "symbol" ? (t = Pf(n), n = pt(a).hoistableScripts, r = n.get(t), r || (r = {
				type: "script",
				instance: null,
				count: 0,
				state: null
			}, n.set(t, r)), r) : {
				type: "void",
				instance: null,
				count: 0,
				state: null
			};
			default: throw Error(i(444, e));
		}
	}
	function Af(e) {
		return "href=\"" + Nt(e) + "\"";
	}
	function jf(e) {
		return "link[rel=\"stylesheet\"][" + e + "]";
	}
	function Mf(e) {
		return h({}, e, {
			"data-precedence": e.precedence,
			precedence: null
		});
	}
	function Nf(e, t, n, r) {
		e.querySelector("link[rel=\"preload\"][as=\"style\"][" + t + "]") ? r.loading = 1 : (t = e.createElement("link"), r.preload = t, t.addEventListener("load", function() {
			return r.loading |= 1;
		}), t.addEventListener("error", function() {
			return r.loading |= 2;
		}), Pd(t, "link", n), mt(t), e.head.appendChild(t));
	}
	function Pf(e) {
		return "[src=\"" + Nt(e) + "\"]";
	}
	function Ff(e) {
		return "script[async]" + e;
	}
	function If(e, t, n) {
		if (t.count++, t.instance === null) switch (t.type) {
			case "style":
				var r = e.querySelector("style[data-href~=\"" + Nt(n.href) + "\"]");
				if (r) return t.instance = r, mt(r), r;
				var a = h({}, n, {
					"data-href": n.href,
					"data-precedence": n.precedence,
					href: null,
					precedence: null
				});
				return r = (e.ownerDocument || e).createElement("style"), mt(r), Pd(r, "style", a), Lf(r, n.precedence, e), t.instance = r;
			case "stylesheet":
				a = Af(n.href);
				var o = e.querySelector(jf(a));
				if (o) return t.state.loading |= 4, t.instance = o, mt(o), o;
				r = Mf(n), (a = mf.get(a)) && Rf(r, a), o = (e.ownerDocument || e).createElement("link"), mt(o);
				var s = o;
				return s._p = new Promise(function(e, t) {
					s.onload = e, s.onerror = t;
				}), Pd(o, "link", r), t.state.loading |= 4, Lf(o, n.precedence, e), t.instance = o;
			case "script": return o = Pf(n.src), (a = e.querySelector(Ff(o))) ? (t.instance = a, mt(a), a) : (r = n, (a = mf.get(o)) && (r = h({}, n), zf(r, a)), e = e.ownerDocument || e, a = e.createElement("script"), mt(a), Pd(a, "link", r), e.head.appendChild(a), t.instance = a);
			case "void": return null;
			default: throw Error(i(443, t.type));
		}
		else t.type === "stylesheet" && !(t.state.loading & 4) && (r = t.instance, t.state.loading |= 4, Lf(r, n.precedence, e));
		return t.instance;
	}
	function Lf(e, t, n) {
		for (var r = n.querySelectorAll("link[rel=\"stylesheet\"][data-precedence],style[data-precedence]"), i = r.length ? r[r.length - 1] : null, a = i, o = 0; o < r.length; o++) {
			var s = r[o];
			if (s.dataset.precedence === t) a = s;
			else if (a !== i) break;
		}
		a ? a.parentNode.insertBefore(e, a.nextSibling) : (t = n.nodeType === 9 ? n.head : n, t.insertBefore(e, t.firstChild));
	}
	function Rf(e, t) {
		e.crossOrigin ??= t.crossOrigin, e.referrerPolicy ??= t.referrerPolicy, e.title ??= t.title;
	}
	function zf(e, t) {
		e.crossOrigin ??= t.crossOrigin, e.referrerPolicy ??= t.referrerPolicy, e.integrity ??= t.integrity;
	}
	var Bf = null;
	function Vf(e, t, n) {
		if (Bf === null) {
			var r = /* @__PURE__ */ new Map(), i = Bf = /* @__PURE__ */ new Map();
			i.set(n, r);
		} else i = Bf, r = i.get(n), r || (r = /* @__PURE__ */ new Map(), i.set(n, r));
		if (r.has(e)) return r;
		for (r.set(e, null), n = n.getElementsByTagName(e), i = 0; i < n.length; i++) {
			var a = n[i];
			if (!(a[ct] || a[rt] || e === "link" && a.getAttribute("rel") === "stylesheet") && a.namespaceURI !== "http://www.w3.org/2000/svg") {
				var o = a.getAttribute(t) || "";
				o = e + o;
				var s = r.get(o);
				s ? s.push(a) : r.set(o, [a]);
			}
		}
		return r;
	}
	function Hf(e, t, n) {
		e = e.ownerDocument || e, e.head.insertBefore(n, t === "title" ? e.querySelector("head > title") : null);
	}
	function Uf(e, t, n) {
		if (n === 1 || t.itemProp != null) return !1;
		switch (e) {
			case "meta":
			case "title": return !0;
			case "style":
				if (typeof t.precedence != "string" || typeof t.href != "string" || t.href === "") break;
				return !0;
			case "link":
				if (typeof t.rel != "string" || typeof t.href != "string" || t.href === "" || t.onLoad || t.onError) break;
				switch (t.rel) {
					case "stylesheet": return e = t.disabled, typeof t.precedence == "string" && e == null;
					default: return !0;
				}
			case "script": if (t.async && typeof t.async != "function" && typeof t.async != "symbol" && !t.onLoad && !t.onError && t.src && typeof t.src == "string") return !0;
		}
		return !1;
	}
	function Wf(e) {
		return !(e.type === "stylesheet" && !(e.state.loading & 3));
	}
	function Gf(e, t, n, r) {
		if (n.type === "stylesheet" && (typeof r.media != "string" || !1 !== matchMedia(r.media).matches) && !(n.state.loading & 4)) {
			if (n.instance === null) {
				var i = Af(r.href), a = t.querySelector(jf(i));
				if (a) {
					t = a._p, typeof t == "object" && t && typeof t.then == "function" && (e.count++, e = Jf.bind(e), t.then(e, e)), n.state.loading |= 4, n.instance = a, mt(a);
					return;
				}
				a = t.ownerDocument || t, r = Mf(r), (i = mf.get(i)) && Rf(r, i), a = a.createElement("link"), mt(a);
				var o = a;
				o._p = new Promise(function(e, t) {
					o.onload = e, o.onerror = t;
				}), Pd(a, "link", r), n.instance = a;
			}
			e.stylesheets === null && (e.stylesheets = /* @__PURE__ */ new Map()), e.stylesheets.set(n, t), (t = n.state.preload) && !(n.state.loading & 3) && (e.count++, n = Jf.bind(e), t.addEventListener("load", n), t.addEventListener("error", n));
		}
	}
	var Kf = 0;
	function qf(e, t) {
		return e.stylesheets && e.count === 0 && Xf(e, e.stylesheets), 0 < e.count || 0 < e.imgCount ? function(n) {
			var r = setTimeout(function() {
				if (e.stylesheets && Xf(e, e.stylesheets), e.unsuspend) {
					var t = e.unsuspend;
					e.unsuspend = null, t();
				}
			}, 6e4 + t);
			0 < e.imgBytes && Kf === 0 && (Kf = 62500 * Ld());
			var i = setTimeout(function() {
				if (e.waitingForImages = !1, e.count === 0 && (e.stylesheets && Xf(e, e.stylesheets), e.unsuspend)) {
					var t = e.unsuspend;
					e.unsuspend = null, t();
				}
			}, (e.imgBytes > Kf ? 50 : 800) + t);
			return e.unsuspend = n, function() {
				e.unsuspend = null, clearTimeout(r), clearTimeout(i);
			};
		} : null;
	}
	function Jf() {
		if (this.count--, this.count === 0 && (this.imgCount === 0 || !this.waitingForImages)) {
			if (this.stylesheets) Xf(this, this.stylesheets);
			else if (this.unsuspend) {
				var e = this.unsuspend;
				this.unsuspend = null, e();
			}
		}
	}
	var Yf = null;
	function Xf(e, t) {
		e.stylesheets = null, e.unsuspend !== null && (e.count++, Yf = /* @__PURE__ */ new Map(), t.forEach(Zf, e), Yf = null, Jf.call(e));
	}
	function Zf(e, t) {
		if (!(t.state.loading & 4)) {
			var n = Yf.get(e);
			if (n) var r = n.get(null);
			else {
				n = /* @__PURE__ */ new Map(), Yf.set(e, n);
				for (var i = e.querySelectorAll("link[data-precedence],style[data-precedence]"), a = 0; a < i.length; a++) {
					var o = i[a];
					(o.nodeName === "LINK" || o.getAttribute("media") !== "not all") && (n.set(o.dataset.precedence, o), r = o);
				}
				r && n.set(null, r);
			}
			i = t.instance, o = i.getAttribute("data-precedence"), a = n.get(o) || r, a === r && n.set(null, i), n.set(o, i), this.count++, r = Jf.bind(this), i.addEventListener("load", r), i.addEventListener("error", r), a ? a.parentNode.insertBefore(i, a.nextSibling) : (e = e.nodeType === 9 ? e.head : e, e.insertBefore(i, e.firstChild)), t.state.loading |= 4;
		}
	}
	var Qf = {
		$$typeof: C,
		Provider: null,
		Consumer: null,
		_currentValue: te,
		_currentValue2: te,
		_threadCount: 0
	};
	function $f(e, t, n, r, i, a, o, s, c) {
		this.tag = 1, this.containerInfo = e, this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = -1, this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null, this.callbackPriority = 0, this.expirationTimes = Ke(-1), this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = Ke(0), this.hiddenUpdates = Ke(null), this.identifierPrefix = r, this.onUncaughtError = i, this.onCaughtError = a, this.onRecoverableError = o, this.pooledCache = null, this.pooledCacheLanes = 0, this.formState = c, this.incompleteTransitions = /* @__PURE__ */ new Map();
	}
	function ep(e, t, n, r, i, a, o, s, c, l, u, d) {
		return e = new $f(e, t, n, o, c, l, u, d, s), t = 1, !0 === a && (t |= 24), a = ti(3, null, null, t), e.current = a, a.stateNode = e, t = ta(), t.refCount++, e.pooledCache = t, t.refCount++, a.memoizedState = {
			element: r,
			isDehydrated: n,
			cache: t
		}, Pa(a), e;
	}
	function tp(e) {
		return e ? (e = $r, e) : $r;
	}
	function np(e, t, n, r, i, a) {
		i = tp(i), r.context === null ? r.context = i : r.pendingContext = i, r = Ia(t), r.payload = { element: n }, a = a === void 0 ? null : a, a !== null && (r.callback = a), n = La(e, r, t), n !== null && (mu(n, e, t), Ra(n, e, t));
	}
	function rp(e, t) {
		if (e = e.memoizedState, e !== null && e.dehydrated !== null) {
			var n = e.retryLane;
			e.retryLane = n !== 0 && n < t ? n : t;
		}
	}
	function ip(e, t) {
		rp(e, t), (e = e.alternate) && rp(e, t);
	}
	function ap(e) {
		if (e.tag === 13 || e.tag === 31) {
			var t = Xr(e, 67108864);
			t !== null && mu(t, e, 67108864), ip(e, 67108864);
		}
	}
	function op(e) {
		if (e.tag === 13 || e.tag === 31) {
			var t = fu();
			t = Qe(t);
			var n = Xr(e, t);
			n !== null && mu(n, e, t), ip(e, t);
		}
	}
	var sp = !0;
	function cp(e, t, n, r) {
		var i = F.T;
		F.T = null;
		var a = I.p;
		try {
			I.p = 2, up(e, t, n, r);
		} finally {
			I.p = a, F.T = i;
		}
	}
	function lp(e, t, n, r) {
		var i = F.T;
		F.T = null;
		var a = I.p;
		try {
			I.p = 8, up(e, t, n, r);
		} finally {
			I.p = a, F.T = i;
		}
	}
	function up(e, t, n, r) {
		if (sp) {
			var i = dp(r);
			if (i === null) Cd(e, t, r, fp, n), Cp(e, r);
			else if (Tp(i, e, t, n, r)) r.stopPropagation();
			else if (Cp(e, r), t & 4 && -1 < Sp.indexOf(e)) {
				for (; i !== null;) {
					var a = dt(i);
					if (a !== null) switch (a.tag) {
						case 3:
							if (a = a.stateNode, a.current.memoizedState.isDehydrated) {
								var o = He(a.pendingLanes);
								if (o !== 0) {
									var s = a;
									for (s.pendingLanes |= 2, s.entangledLanes |= 2; o;) {
										var c = 1 << 31 - Fe(o);
										s.entanglements[1] |= c, o &= ~c;
									}
									nd(a), !(J & 6) && (eu = z() + 500, rd(0, !1));
								}
							}
							break;
						case 31:
						case 13: s = Xr(a, 2), s !== null && mu(s, a, 2), yu(), ip(a, 2);
					}
					if (a = dp(r), a === null && Cd(e, t, r, fp, n), a === i) break;
					i = a;
				}
				i !== null && r.stopPropagation();
			} else Cd(e, t, r, null, n);
		}
	}
	function dp(e) {
		return e = Xt(e), pp(e);
	}
	var fp = null;
	function pp(e) {
		if (fp = null, e = ut(e), e !== null) {
			var t = o(e);
			if (t === null) e = null;
			else {
				var n = t.tag;
				if (n === 13) {
					if (e = s(t), e !== null) return e;
					e = null;
				} else if (n === 31) {
					if (e = c(t), e !== null) return e;
					e = null;
				} else if (n === 3) {
					if (t.stateNode.current.memoizedState.isDehydrated) return t.tag === 3 ? t.stateNode.containerInfo : null;
					e = null;
				} else t !== e && (e = null);
			}
		}
		return fp = e, null;
	}
	function mp(e) {
		switch (e) {
			case "beforetoggle":
			case "cancel":
			case "click":
			case "close":
			case "contextmenu":
			case "copy":
			case "cut":
			case "auxclick":
			case "dblclick":
			case "dragend":
			case "dragstart":
			case "drop":
			case "focusin":
			case "focusout":
			case "input":
			case "invalid":
			case "keydown":
			case "keypress":
			case "keyup":
			case "mousedown":
			case "mouseup":
			case "paste":
			case "pause":
			case "play":
			case "pointercancel":
			case "pointerdown":
			case "pointerup":
			case "ratechange":
			case "reset":
			case "resize":
			case "seeked":
			case "submit":
			case "toggle":
			case "touchcancel":
			case "touchend":
			case "touchstart":
			case "volumechange":
			case "change":
			case "selectionchange":
			case "textInput":
			case "compositionstart":
			case "compositionend":
			case "compositionupdate":
			case "beforeblur":
			case "afterblur":
			case "beforeinput":
			case "blur":
			case "fullscreenchange":
			case "focus":
			case "hashchange":
			case "popstate":
			case "select":
			case "selectstart": return 2;
			case "drag":
			case "dragenter":
			case "dragexit":
			case "dragleave":
			case "dragover":
			case "mousemove":
			case "mouseout":
			case "mouseover":
			case "pointermove":
			case "pointerout":
			case "pointerover":
			case "scroll":
			case "touchmove":
			case "wheel":
			case "mouseenter":
			case "mouseleave":
			case "pointerenter":
			case "pointerleave": return 8;
			case "message": switch (Te()) {
				case Ee: return 2;
				case De: return 8;
				case Oe:
				case ke: return 32;
				case Ae: return 268435456;
				default: return 32;
			}
			default: return 32;
		}
	}
	var hp = !1, gp = null, _p = null, vp = null, yp = /* @__PURE__ */ new Map(), bp = /* @__PURE__ */ new Map(), xp = [], Sp = "mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset".split(" ");
	function Cp(e, t) {
		switch (e) {
			case "focusin":
			case "focusout":
				gp = null;
				break;
			case "dragenter":
			case "dragleave":
				_p = null;
				break;
			case "mouseover":
			case "mouseout":
				vp = null;
				break;
			case "pointerover":
			case "pointerout":
				yp.delete(t.pointerId);
				break;
			case "gotpointercapture":
			case "lostpointercapture": bp.delete(t.pointerId);
		}
	}
	function wp(e, t, n, r, i, a) {
		return e === null || e.nativeEvent !== a ? (e = {
			blockedOn: t,
			domEventName: n,
			eventSystemFlags: r,
			nativeEvent: a,
			targetContainers: [i]
		}, t !== null && (t = dt(t), t !== null && ap(t)), e) : (e.eventSystemFlags |= r, t = e.targetContainers, i !== null && t.indexOf(i) === -1 && t.push(i), e);
	}
	function Tp(e, t, n, r, i) {
		switch (t) {
			case "focusin": return gp = wp(gp, e, t, n, r, i), !0;
			case "dragenter": return _p = wp(_p, e, t, n, r, i), !0;
			case "mouseover": return vp = wp(vp, e, t, n, r, i), !0;
			case "pointerover":
				var a = i.pointerId;
				return yp.set(a, wp(yp.get(a) || null, e, t, n, r, i)), !0;
			case "gotpointercapture": return a = i.pointerId, bp.set(a, wp(bp.get(a) || null, e, t, n, r, i)), !0;
		}
		return !1;
	}
	function Ep(e) {
		var t = ut(e.target);
		if (t !== null) {
			var n = o(t);
			if (n !== null) {
				if (t = n.tag, t === 13) {
					if (t = s(n), t !== null) {
						e.blockedOn = t, tt(e.priority, function() {
							op(n);
						});
						return;
					}
				} else if (t === 31) {
					if (t = c(n), t !== null) {
						e.blockedOn = t, tt(e.priority, function() {
							op(n);
						});
						return;
					}
				} else if (t === 3 && n.stateNode.current.memoizedState.isDehydrated) {
					e.blockedOn = n.tag === 3 ? n.stateNode.containerInfo : null;
					return;
				}
			}
		}
		e.blockedOn = null;
	}
	function Dp(e) {
		if (e.blockedOn !== null) return !1;
		for (var t = e.targetContainers; 0 < t.length;) {
			var n = dp(e.nativeEvent);
			if (n === null) {
				n = e.nativeEvent;
				var r = new n.constructor(n.type, n);
				Yt = r, n.target.dispatchEvent(r), Yt = null;
			} else return t = dt(n), t !== null && ap(t), e.blockedOn = n, !1;
			t.shift();
		}
		return !0;
	}
	function Op(e, t, n) {
		Dp(e) && n.delete(t);
	}
	function kp() {
		hp = !1, gp !== null && Dp(gp) && (gp = null), _p !== null && Dp(_p) && (_p = null), vp !== null && Dp(vp) && (vp = null), yp.forEach(Op), bp.forEach(Op);
	}
	function Ap(e, n) {
		e.blockedOn === n && (e.blockedOn = null, hp || (hp = !0, t.unstable_scheduleCallback(t.unstable_NormalPriority, kp)));
	}
	var jp = null;
	function Mp(e) {
		jp !== e && (jp = e, t.unstable_scheduleCallback(t.unstable_NormalPriority, function() {
			jp === e && (jp = null);
			for (var t = 0; t < e.length; t += 3) {
				var n = e[t], r = e[t + 1], i = e[t + 2];
				if (typeof r != "function") {
					if (pp(r || n) === null) continue;
					break;
				}
				var a = dt(n);
				a !== null && (e.splice(t, 3), t -= 3, bs(a, {
					pending: !0,
					data: i,
					method: n.method,
					action: r
				}, r, i));
			}
		}));
	}
	function Np(e) {
		function t(t) {
			return Ap(t, e);
		}
		gp !== null && Ap(gp, e), _p !== null && Ap(_p, e), vp !== null && Ap(vp, e), yp.forEach(t), bp.forEach(t);
		for (var n = 0; n < xp.length; n++) {
			var r = xp[n];
			r.blockedOn === e && (r.blockedOn = null);
		}
		for (; 0 < xp.length && (n = xp[0], n.blockedOn === null);) Ep(n), n.blockedOn === null && xp.shift();
		if (n = (e.ownerDocument || e).$$reactFormReplay, n != null) for (r = 0; r < n.length; r += 3) {
			var i = n[r], a = n[r + 1], o = i[it] || null;
			if (typeof a == "function") o || Mp(n);
			else if (o) {
				var s = null;
				if (a && a.hasAttribute("formAction")) {
					if (i = a, o = a[it] || null) s = o.formAction;
					else if (pp(i) !== null) continue;
				} else s = o.action;
				typeof s == "function" ? n[r + 1] = s : (n.splice(r, 3), r -= 3), Mp(n);
			}
		}
	}
	function Pp() {
		function e(e) {
			e.canIntercept && e.info === "react-transition" && e.intercept({
				handler: function() {
					return new Promise(function(e) {
						return i = e;
					});
				},
				focusReset: "manual",
				scroll: "manual"
			});
		}
		function t() {
			i !== null && (i(), i = null), r || setTimeout(n, 20);
		}
		function n() {
			if (!r && !navigation.transition) {
				var e = navigation.currentEntry;
				e && e.url != null && navigation.navigate(e.url, {
					state: e.getState(),
					info: "react-transition",
					history: "replace"
				});
			}
		}
		if (typeof navigation == "object") {
			var r = !1, i = null;
			return navigation.addEventListener("navigate", e), navigation.addEventListener("navigatesuccess", t), navigation.addEventListener("navigateerror", t), setTimeout(n, 100), function() {
				r = !0, navigation.removeEventListener("navigate", e), navigation.removeEventListener("navigatesuccess", t), navigation.removeEventListener("navigateerror", t), i !== null && (i(), i = null);
			};
		}
	}
	function Fp(e) {
		this._internalRoot = e;
	}
	Ip.prototype.render = Fp.prototype.render = function(e) {
		var t = this._internalRoot;
		if (t === null) throw Error(i(409));
		var n = t.current;
		np(n, fu(), e, t, null, null);
	}, Ip.prototype.unmount = Fp.prototype.unmount = function() {
		var e = this._internalRoot;
		if (e !== null) {
			this._internalRoot = null;
			var t = e.containerInfo;
			np(e.current, 2, null, e, null, null), yu(), t[at] = null;
		}
	};
	function Ip(e) {
		this._internalRoot = e;
	}
	Ip.prototype.unstable_scheduleHydration = function(e) {
		if (e) {
			var t = et();
			e = {
				blockedOn: null,
				target: e,
				priority: t
			};
			for (var n = 0; n < xp.length && t !== 0 && t < xp[n].priority; n++);
			xp.splice(n, 0, e), n === 0 && Ep(e);
		}
	};
	var Lp = n.version;
	if (Lp !== "19.2.7") throw Error(i(527, Lp, "19.2.7"));
	I.findDOMNode = function(e) {
		var t = e._reactInternals;
		if (t === void 0) throw typeof e.render == "function" ? Error(i(188)) : (e = Object.keys(e).join(","), Error(i(268, e)));
		return e = d(t), e = e === null ? null : p(e), e = e === null ? null : e.stateNode, e;
	};
	var Rp = {
		bundleType: 0,
		version: "19.2.7",
		rendererPackageName: "react-dom",
		currentDispatcherRef: F,
		reconcilerVersion: "19.2.7"
	};
	if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u") {
		var zp = __REACT_DEVTOOLS_GLOBAL_HOOK__;
		if (!zp.isDisabled && zp.supportsFiber) try {
			Ne = zp.inject(Rp), B = zp;
		} catch {}
	}
	e.createRoot = function(e, t) {
		if (!a(e)) throw Error(i(299));
		var n = !1, r = "", o = Us, s = Ws, c = Gs;
		return t != null && (!0 === t.unstable_strictMode && (n = !0), t.identifierPrefix !== void 0 && (r = t.identifierPrefix), t.onUncaughtError !== void 0 && (o = t.onUncaughtError), t.onCaughtError !== void 0 && (s = t.onCaughtError), t.onRecoverableError !== void 0 && (c = t.onRecoverableError)), t = ep(e, 1, !1, null, null, n, r, null, o, s, c, Pp), e[at] = t.current, xd(e), new Fp(t);
	};
})), g = /* @__PURE__ */ o(((e, t) => {
	function n() {
		if (!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u" || typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE != "function")) try {
			__REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(n);
		} catch (e) {
			console.error(e);
		}
	}
	n(), t.exports = h();
})), _ = /* @__PURE__ */ o(((e) => {
	var t = Symbol.for("react.transitional.element"), n = Symbol.for("react.fragment");
	function r(e, n, r) {
		var i = null;
		if (r !== void 0 && (i = "" + r), n.key !== void 0 && (i = "" + n.key), "key" in n) for (var a in r = {}, n) a !== "key" && (r[a] = n[a]);
		else r = n;
		return n = r.ref, {
			$$typeof: t,
			type: e,
			key: i,
			ref: n === void 0 ? null : n,
			props: r
		};
	}
	e.Fragment = n, e.jsx = r, e.jsxs = r;
})), v = /* @__PURE__ */ o(((e, t) => {
	t.exports = _();
})), y = g(), b = /* @__PURE__ */ c(u(), 1), x = v(), S = [
	{
		id: "connections",
		label: "חיבורים"
	},
	{
		id: "agents",
		label: "סוכני AI"
	},
	{
		id: "contractsAgent",
		label: "סוכן חוזים"
	},
	{
		id: "scheduleAgent",
		label: "סוכן שיוך ללו״ז"
	},
	{
		id: "retrieval",
		label: "שליפה ו-RAG"
	},
	{
		id: "content",
		label: "APP DATA"
	},
	{
		id: "tools",
		label: "כלים n8n"
	},
	{
		id: "memory",
		label: "זיכרון"
	},
	{
		id: "performance",
		label: "ביצועים ו-Cache"
	},
	{
		id: "presets",
		label: "פריסטים"
	},
	{
		id: "general",
		label: "כללי"
	}
], C = [
	{
		key: "classifier",
		label: "Classifier",
		desc: "ניתוב וסיווג השאלה",
		promptRows: 9
	},
	{
		key: "knowledgePlanner",
		label: "Knowledge Planner",
		desc: "תכנון חיפוש ידע מקומי",
		promptRows: 9
	},
	{
		key: "main",
		label: "Main",
		desc: "תשובת הצ׳אט הראשית",
		promptRows: 12,
		wide: !0
	},
	{
		key: "lite",
		label: "Lite",
		desc: "משימות קצרות ועזר",
		promptRows: 7
	},
	{
		key: "reranker",
		label: "Reranker",
		desc: "דירוג מקורות לפני תשובה",
		promptRows: 9
	},
	{
		key: "qa",
		label: "QA Report",
		desc: "ניתוח איכות ריצה",
		promptRows: 9
	}
], w = {
	temperature: "קובע כמה התשובה תהיה יצירתית או צפויה. ערך נמוך נותן תשובות יציבות ומדויקות יותר; ערך גבוה נותן ניסוח מגוון יותר.",
	maxTokens: "מגביל את אורך התשובה שהמודל יכול לייצר. ערך גבוה מאפשר תשובה מפורטת יותר, אבל יכול לעלות יותר ולקחת יותר זמן.",
	timeoutMs: "כמה זמן המערכת תחכה לתשובת המודל לפני שהיא מחשיבה את הקריאה כתקועה. נמדד במילישניות.",
	embeddingModel: "המודל שיוצר את הווקטורים (embeddings) של הטקסט לצורך חיפוש סמנטי. חייב להתאים למודל שבו נוצר האינדקס ב-Supabase.",
	hybridRpcName: "שם פונקציית ה-RPC ב-Supabase שמריצה את החיפוש ההיברידי (וקטורי + מילולי). חייב להתאים לפונקציה שקיימת במסד.",
	hybridCandidates: "כמה שורות כל חיפוש היברידי ראשי יבקש מ-Supabase. ערך גבוה מגדיל כיסוי, אך מוסיף זמן, עומס ועלות דירוג.",
	plannerCandidates: "כמה שורות תוחזרנה מכל שאילתת חיפוש נוספת שה-Knowledge Planner יוצר. הכמות הכוללת יכולה להיות מספר השאילתות כפול ערך זה.",
	alertCandidates: "כמה התראות סוכן Alerts יבקש מפונקציית החיפוש לפני סינון תאריכים וסיכום התוצאה.",
	rerankTopK: "כמה מהשורות שנמצאו יישארו לאחר דירוג הרלוונטיות. רק התוצאות המדורגות ביותר ממשיכות לשלבים הבאים.",
	vectorWeight: "משקל החיפוש הסמנטי (וקטורי) בציון ההיברידי. ביחד עם משקל המילים הוא קובע איזה סוג התאמה חשוב יותר. בדרך כלל מסתכם ל-1 עם משקל המילים.",
	keywordWeight: "משקל החיפוש המילולי (מילות מפתח) בציון ההיברידי. ערך גבוה מחזק התאמות טקסטואליות מדויקות על פני התאמה משמעותית.",
	ragContextRecordsLimit: "כמה מקורות אחרי החיפוש והדירוג ייכנסו בפועל לסוכן הראשי. יותר מקורות נותנים כיסוי רחב יותר אבל עלולים להעמיס.",
	ragChunkTextLimit: "כמה תווים מכל מקור ייכנסו לפרומפט. ערך גבוה נותן יותר הקשר מכל מקור, אבל מגדיל עלות וזמן.",
	ragPlannerExtraQueriesLimit: "כמה שאילתות נוספות Knowledge Planner רשאי להריץ מעבר לשאלה המקורית.",
	graphLimit: "כמה קשרים מהגרף ייכנסו בפועל לתשובת הצ׳אט. ערך 0 מכבה את שילוב הגרף.",
	graphDaysBack: "כמה ימים אחורה לחפש קשרים בגרף הפרויקט סביב תוצאות ה-RAG.",
	timelineLimit: "מספר השורות המקסימלי שיימשכו עבור ציר הזמן. ערך גבוה מציג היסטוריה מלאה יותר אבל כבד יותר לטעינה.",
	timelineDaysBack: "כמה ימים אחורה לכלול באירועי ציר הזמן. מגביל את חלון הזמן הנשלף מהמסד.",
	graphSearchLimit: "כמה קשרים/צמתים לחפש בגרף סביב תוצאות ה-RAG.",
	graphContextLimit: "כמה קשרים מהגרף ייכנסו בפועל לתשובת הצ׳אט.",
	graphEnabled: "כאשר פעיל, הצ׳אט משתמש בגרף הפרויקט כדי לזהות קשרים בין אירועים, ספקים, נושאים וסיכונים.",
	graphExpandedForListQuestions: "בשאלות כמו 'מי', 'מה עוד', או 'רשימה', מאפשר להכניס יותר קשרי גרף כדי לא לפספס מועמדים.",
	knowledgeAgentLimit: "כמה סוכני Knowledge Base מקומיים אפשר לבחור לשאלה אחת.",
	knowledgeTopK: "כמה קטעי ידע מקומי יוחזרו מכל סוכן ידע שנבחר.",
	knowledgeChunkSize: "האורך המקסימלי של כל קטע ידע מקומי שנכנס לתכנון החיפוש.",
	toolsParallelLimit: "כמה כלי N8N אפשר להריץ במקביל באותה שאלה.",
	toolsEnabled: "כאשר כבוי, הצ׳אט לא יקרא לכלי N8N חיצוניים, אבל RAG ו-Graph עדיין יכולים לעבוד.",
	toolsAlertAgentEnabled: "כאשר פעיל, סוכן ההתראות יכול למשוך ולסכם נתונים מטבלת alerts.",
	toolsSafetyPrecheckEnabled: "כאשר פעיל, שאלות דחופות או בטיחותיות מפעילות בדיקה מוקדמת לפני שאר הכלים.",
	alertTemperature: "קובע כמה התשובה של סוכן ההתראות תהיה יציבה. ערך נמוך נותן ניתוח עקבי יותר.",
	alertMaxTokens: "מגביל את אורך התשובה של סוכן ההתראות.",
	alertTimeoutMs: "כמה זמן לחכות לתשובת סוכן ההתראות לפני שמחשיבים את הקריאה כתקועה. נמדד במילישניות.",
	cacheEnabled: "כאשר פעיל, תשובות ותוצאות חיפוש נשמרות זמנית כדי להאיץ שאלות חוזרות ולהפחית עלות.",
	cacheProvider: "היכן לשמור את ה-cache: Memory לפיתוח (נמחק בכל הפעלה), Redis ל-Production, או ללא cache.",
	cacheRedisUrl: "כתובת חיבור ל-Redis כאשר נבחר provider מסוג Redis. נשמר כסוד — השאר ריק כדי לשמור את הערך הקיים.",
	cacheMemoryMaxEntries: "מספר הרשומות המקסימלי שיישמרו ב-cache מסוג Memory לפני שהישנות נמחקות."
}, T = /* @__PURE__ */ "UTC-12.UTC-11.UTC-10.UTC-9.UTC-8.UTC-7.UTC-6.UTC-5.UTC-4.UTC-3.UTC-2.UTC-1.UTC+0 (Greenwich).UTC+1.UTC+2.Asia/Jerusalem.UTC+3.UTC+4.UTC+5.UTC+5:30 (הודו).UTC+6.UTC+7.UTC+8.UTC+9.UTC+10.UTC+11.UTC+12".split(".");
async function E(e, t = {}) {
	let n = await fetch(e, {
		headers: { "Content-Type": "application/json" },
		...t,
		body: t.body ? JSON.stringify(t.body) : void 0
	});
	if (!n.ok) throw Error(`HTTP ${n.status}`);
	return n.json();
}
function D(e, t, n) {
	let r = t.split("."), i = { ...e }, a = i;
	for (let e = 0; e < r.length - 1; e++) a[r[e]] = { ...a[r[e]] }, a = a[r[e]];
	return a[r[r.length - 1]] = n, i;
}
function O(e) {
	return e ? {
		models: { ...e.models },
		prompts: { ...e.prompts },
		ai: e.ai ? JSON.parse(JSON.stringify(e.ai)) : {},
		retrieval: { ...e.retrieval },
		rag: { ...e.rag },
		graph: { ...e.graph },
		cache: {
			...e.cache,
			redisUrl: ""
		},
		memory: e.memory ? JSON.parse(JSON.stringify(e.memory)) : {},
		knowledge: {
			...e.knowledge,
			triggerKeywords: (e.knowledge?.triggerKeywords || []).join("\n")
		},
		toolsRuntime: { ...e.toolsRuntime },
		secrets: {
			openRouterApiKey: "",
			supabaseUrl: e.secrets?.supabaseUrl || "",
			supabaseServiceRoleKey: ""
		},
		contentSource: {
			...e.contentSource,
			useAppSupabase: e.contentSource?.usesAppSupabase === !0,
			supabaseServiceRoleKey: ""
		},
		n8nBaseUrl: e.n8nBaseUrl || "",
		tools: e.tools ? Object.fromEntries(Object.entries(e.tools).map(([e, t]) => [e, t?.url || ""])) : {},
		timezone: e.timezone || "Asia/Jerusalem",
		presets: e.presets || [],
		scheduleAssignmentAgent: e.scheduleAssignmentAgent ? JSON.parse(JSON.stringify(e.scheduleAssignmentAgent)) : {},
		contractsAgent: e.contractsAgent ? JSON.parse(JSON.stringify(e.contractsAgent)) : {}
	} : {};
}
function k(e) {
	return {
		models: e.models,
		prompts: e.prompts,
		ai: e.ai,
		retrieval: e.retrieval,
		rag: e.rag,
		graph: e.graph,
		cache: e.cache,
		memory: e.memory,
		knowledge: {
			...e.knowledge,
			triggerKeywords: (e.knowledge?.triggerKeywords || "").split("\n").map((e) => e.trim()).filter(Boolean)
		},
		toolsRuntime: e.toolsRuntime,
		secrets: e.secrets,
		contentSource: e.contentSource,
		n8nBaseUrl: e.n8nBaseUrl,
		tools: Object.fromEntries(Object.entries(e.tools || {}).map(([e, t]) => [e, { url: t }])),
		timezone: e.timezone,
		scheduleAssignmentAgent: e.scheduleAssignmentAgent,
		contractsAgent: e.contractsAgent
	};
}
var A = ({ path: e, size: t = 16, ...n }) => /* @__PURE__ */ (0, x.jsx)("svg", {
	width: t,
	height: t,
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: "1.8",
	strokeLinecap: "round",
	strokeLinejoin: "round",
	...n,
	children: /* @__PURE__ */ (0, x.jsx)("path", { d: e })
}), j = {
	info: "M12 22C6.5 22 2 17.5 2 12S6.5 2 12 2s10 4.5 10 10-4.5 10-10 10zm0-11v5m0-8h.01",
	connections: "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
	agents: "M12 2a5 5 0 1 0 0 10A5 5 0 0 0 12 2zM3.5 22a8.5 8.5 0 0 1 17 0",
	contractsAgent: "M6 2h9l4 4v16H6zM14 2v5h5M9 12h7M9 16h7M9 8h2",
	scheduleAgent: "M4 5h16M7 3v4m10-4v4M5 9h14v11H5zM9 13l2 2 4-4",
	retrieval: "M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z",
	content: "M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7zm0 5h16M8 3v4M16 3v4",
	tools: "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3-3a1 1 0 0 0 0-1.4L19 3.3a1 1 0 0 0-1.4 0zM5 17l-1 4 4-1L20 8l-3-3zM16 5l3 3",
	presets: "M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2zM17 21v-8H7v8M7 3v5h8",
	performance: "M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm1.5-1.5L18 8M5 19a9 9 0 1 1 14 0",
	memory: "M9 3a3 3 0 0 0-3 3v1a3 3 0 0 0-2 5.2A3 3 0 0 0 6 17v1a3 3 0 0 0 5 2.2V3H9zm6 0a3 3 0 0 1 3 3v1a3 3 0 0 1 2 5.2A3 3 0 0 1 18 17v1a3 3 0 0 1-5 2.2V3h2z",
	general: "M12 22C6.5 22 2 17.5 2 12S6.5 2 12 2s10 4.5 10 10-4.5 10-10 10zm0-14v4l3 3",
	save: "M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2zM17 21v-8H7v8M7 3v5h8",
	reload: "M23 4v6h-6M1 20v-6h6M3.5 9a9 9 0 0 1 14.8-3.5L23 10M1 14l4.7 4.5A9 9 0 0 0 20.5 15",
	upload: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12",
	download: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
	eye: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
	eyeOff: "M17.9 17.4A10 10 0 0 1 12 20c-7 0-11-8-11-8a18.5 18.5 0 0 1 5.1-5.9M9.9 4.2A9 9 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.2 3.2M1 1l22 22",
	check: "M20 6L9 17l-5-5",
	warning: "M10.3 3.3L1.5 18A2 2 0 0 0 3.2 21h17.6a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01",
	chevronDown: "M6 9l6 6 6-6",
	plus: "M12 5v14M5 12h14"
}, M = {
	label: {
		display: "flex",
		flexDirection: "column",
		gap: 5,
		fontSize: 13,
		fontWeight: 500,
		color: "var(--text-primary)"
	},
	input: {
		padding: "7px 10px",
		borderRadius: "var(--r)",
		border: "1px solid var(--line-strong)",
		background: "var(--surface-2)",
		color: "var(--text-primary)",
		fontSize: 13,
		fontFamily: "var(--font-display)",
		width: "100%",
		boxSizing: "border-box",
		transition: "border-color .15s",
		outline: "none"
	},
	hint: {
		fontSize: 12,
		color: "var(--text-muted)",
		lineHeight: 1.5,
		margin: 0
	},
	card: {
		background: "var(--surface)",
		border: "1px solid var(--line)",
		borderRadius: "var(--r-xl)",
		padding: "18px 20px",
		boxShadow: "0 1px 4px rgba(0,0,0,.04)"
	},
	section: {
		display: "flex",
		flexDirection: "column",
		gap: 20
	},
	grid2: {
		display: "grid",
		gridTemplateColumns: "1fr 1fr",
		gap: 14
	},
	grid3: {
		display: "grid",
		gridTemplateColumns: "1fr 1fr 1fr",
		gap: 10
	},
	sectionTitle: {
		fontSize: 13,
		fontWeight: 700,
		color: "var(--text-muted)",
		letterSpacing: .6,
		textTransform: "uppercase",
		margin: "4px 0 10px"
	}
};
function N({ label: e, hint: t, info: n, children: r, wide: i }) {
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		style: {
			...i ? { gridColumn: "1 / -1" } : {},
			...M.label
		},
		children: [
			e && /* @__PURE__ */ (0, x.jsxs)("span", {
				style: {
					display: "inline-flex",
					alignItems: "center",
					gap: 6,
					minWidth: 0
				},
				children: [/* @__PURE__ */ (0, x.jsx)("span", {
					style: {
						overflow: "hidden",
						textOverflow: "ellipsis"
					},
					children: e
				}), n && /* @__PURE__ */ (0, x.jsx)(ee, {
					text: n,
					label: e
				})]
			}),
			r,
			t && /* @__PURE__ */ (0, x.jsx)("p", {
				style: M.hint,
				children: t
			})
		]
	});
}
function ee({ text: e, label: t }) {
	let [n, r] = (0, b.useState)(!1), [i, a] = (0, b.useState)(!1), o = (0, b.useRef)(null), s = n || i;
	return (0, b.useEffect)(() => {
		if (!n) return;
		let e = (e) => {
			o.current && !o.current.contains(e.target) && r(!1);
		}, t = (e) => {
			e.key === "Escape" && r(!1);
		};
		return document.addEventListener("mousedown", e), document.addEventListener("keydown", t), () => {
			document.removeEventListener("mousedown", e), document.removeEventListener("keydown", t);
		};
	}, [n]), /* @__PURE__ */ (0, x.jsxs)("span", {
		ref: o,
		style: {
			position: "relative",
			display: "inline-flex"
		},
		children: [/* @__PURE__ */ (0, x.jsx)("button", {
			type: "button",
			onClick: (e) => {
				e.preventDefault(), r((e) => !e);
			},
			onMouseEnter: () => a(!0),
			onMouseLeave: () => a(!1),
			"aria-label": `מידע על ${typeof t == "string" ? t : "השדה"}`,
			"aria-expanded": n,
			style: {
				width: 16,
				height: 16,
				minHeight: 16,
				minWidth: 16,
				flex: "0 0 auto",
				display: "inline-grid",
				placeItems: "center",
				padding: 0,
				margin: 0,
				lineHeight: 0,
				borderRadius: "999px",
				border: "none",
				background: "none",
				color: s ? "var(--brand-500)" : "var(--text-muted)",
				cursor: "pointer",
				transition: "color .15s, transform .15s",
				transform: s ? "scale(1.08)" : "scale(1)"
			},
			children: /* @__PURE__ */ (0, x.jsx)(A, {
				path: j.info,
				size: 15,
				strokeWidth: 1.9
			})
		}), n && /* @__PURE__ */ (0, x.jsxs)("span", {
			role: "tooltip",
			style: {
				position: "absolute",
				top: "calc(100% + 9px)",
				insetInlineEnd: -4,
				zIndex: 50,
				width: 264,
				maxWidth: 300,
				background: "var(--surface)",
				color: "var(--text-secondary)",
				border: "1px solid var(--line-strong)",
				borderRadius: "var(--r-lg, 12px)",
				boxShadow: "0 10px 30px rgba(15, 23, 42, .18)",
				padding: "11px 13px",
				fontSize: 12.5,
				fontWeight: 500,
				lineHeight: 1.6,
				textAlign: "right",
				fontStyle: "normal",
				whiteSpace: "normal",
				cursor: "default",
				animation: "bidocFade .12s ease-out"
			},
			onClick: (e) => e.stopPropagation(),
			children: [/* @__PURE__ */ (0, x.jsx)("span", { style: {
				position: "absolute",
				top: -6,
				insetInlineEnd: 8,
				width: 11,
				height: 11,
				background: "var(--surface)",
				borderTop: "1px solid var(--line-strong)",
				borderInlineStart: "1px solid var(--line-strong)",
				transform: "rotate(45deg)"
			} }), e]
		})]
	});
}
function P({ children: e }) {
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		style: {
			display: "flex",
			alignItems: "flex-start",
			gap: 7,
			color: "var(--text-muted)",
			fontSize: 12.5,
			lineHeight: 1.55,
			background: "var(--surface-2)",
			border: "1px solid var(--line)",
			borderRadius: "var(--r)",
			padding: "8px 12px",
			marginTop: 2
		},
		children: [/* @__PURE__ */ (0, x.jsx)(A, {
			path: j.info,
			size: 14,
			style: {
				flexShrink: 0,
				marginTop: 1,
				color: "var(--brand-500)"
			}
		}), /* @__PURE__ */ (0, x.jsx)("span", { children: e })]
	});
}
var F = "0 0 0 3px rgba(63, 141, 104, .16)";
function I({ value: e, onChange: t, type: n = "text", placeholder: r, min: i, max: a, step: o, style: s, name: c, autoComplete: l, spellCheck: u, autoCapitalize: d, ...f }) {
	let [p, m] = (0, b.useState)(!1);
	return /* @__PURE__ */ (0, x.jsx)("input", {
		type: n,
		value: e ?? "",
		placeholder: r,
		min: i,
		max: a,
		step: o,
		name: c,
		autoComplete: l,
		spellCheck: u,
		autoCapitalize: d,
		...f,
		onChange: (e) => t(n === "number" ? Number(e.target.value) : e.target.value),
		onFocus: () => m(!0),
		onBlur: () => m(!1),
		style: {
			...M.input,
			borderColor: p ? "var(--brand-500)" : void 0,
			boxShadow: p ? F : "none",
			...s
		}
	});
}
function te({ value: e, onChange: t, children: n, style: r }) {
	let [i, a] = (0, b.useState)(!1);
	return /* @__PURE__ */ (0, x.jsx)("select", {
		value: e ?? "",
		onChange: (e) => t(e.target.value),
		onFocus: () => a(!0),
		onBlur: () => a(!1),
		style: {
			...M.input,
			cursor: "pointer",
			borderColor: i ? "var(--brand-500)" : void 0,
			boxShadow: i ? F : "none",
			...r
		},
		children: n
	});
}
function L({ label: e, checked: t, onChange: n, info: r }) {
	return /* @__PURE__ */ (0, x.jsxs)("label", {
		style: {
			display: "flex",
			alignItems: "center",
			gap: 10,
			cursor: "pointer",
			fontSize: 13,
			fontWeight: 500,
			color: "var(--text-primary)"
		},
		children: [/* @__PURE__ */ (0, x.jsx)("button", {
			type: "button",
			role: "switch",
			"aria-checked": !!t,
			onClick: () => n(!t),
			style: {
				position: "relative",
				width: 36,
				height: 20,
				minHeight: 20,
				minWidth: 36,
				flexShrink: 0,
				borderRadius: 999,
				border: "none",
				cursor: "pointer",
				padding: 0,
				margin: 0,
				background: t ? "var(--brand-500)" : "var(--line-strong)",
				transition: "background .18s"
			},
			children: /* @__PURE__ */ (0, x.jsx)("span", { style: {
				position: "absolute",
				top: 2,
				left: t ? 18 : 2,
				width: 16,
				height: 16,
				borderRadius: "50%",
				background: "#fff",
				transition: "left .18s cubic-bezier(.4,0,.2,1)",
				boxShadow: "0 1px 2px rgba(0,0,0,.28)"
			} })
		}), /* @__PURE__ */ (0, x.jsxs)("span", {
			style: {
				display: "inline-flex",
				alignItems: "center",
				gap: 6
			},
			children: [e, r && /* @__PURE__ */ (0, x.jsx)(ee, {
				text: r,
				label: e
			})]
		})]
	});
}
function ne({ value: e, onChange: t, rows: n = 6, placeholder: r, dir: i, style: a, ...o }) {
	let [s, c] = (0, b.useState)(!1);
	return /* @__PURE__ */ (0, x.jsx)("textarea", {
		value: e ?? "",
		rows: n,
		placeholder: r,
		dir: i,
		onChange: (e) => t(e.target.value),
		onFocus: () => c(!0),
		onBlur: () => c(!1),
		spellCheck: !1,
		...o,
		style: {
			...M.input,
			resize: "vertical",
			lineHeight: 1.5,
			borderColor: s ? "var(--brand-500)" : void 0,
			boxShadow: s ? F : "none",
			...a
		}
	});
}
function re({ label: e, value: t, onChange: n, placeholder: r, hint: i, info: a, disabled: o = !1 }) {
	let [s, c] = (0, b.useState)(!1);
	return /* @__PURE__ */ (0, x.jsx)(N, {
		label: e,
		hint: i,
		info: a,
		children: /* @__PURE__ */ (0, x.jsxs)("div", {
			style: { position: "relative" },
			children: [/* @__PURE__ */ (0, x.jsx)(I, {
				type: "text",
				value: t,
				onChange: n,
				name: `bidoc-secret-${String(e).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
				autoComplete: "off",
				spellCheck: !1,
				autoCapitalize: "none",
				"data-1p-ignore": "true",
				"data-lpignore": "true",
				"data-bwignore": "true",
				"aria-autocomplete": "none",
				disabled: o,
				placeholder: r,
				style: {
					paddingLeft: 36,
					WebkitTextSecurity: s ? "none" : "disc"
				}
			}), /* @__PURE__ */ (0, x.jsx)("button", {
				type: "button",
				onClick: () => c((e) => !e),
				style: {
					position: "absolute",
					left: 8,
					top: "50%",
					transform: "translateY(-50%)",
					background: "none",
					border: "none",
					cursor: "pointer",
					color: "var(--text-muted)",
					padding: 2
				},
				title: s ? "הסתר" : "הצג",
				children: /* @__PURE__ */ (0, x.jsx)(A, {
					path: s ? j.eyeOff : j.eye,
					size: 15
				})
			})]
		})
	});
}
function ie({ title: e, children: t, defaultOpen: n = !1 }) {
	let [r, i] = (0, b.useState)(n);
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		style: {
			borderTop: "1px solid var(--line)",
			marginTop: 4
		},
		children: [/* @__PURE__ */ (0, x.jsxs)("button", {
			onClick: () => i((e) => !e),
			style: {
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
				width: "100%",
				padding: "8px 0",
				background: "none",
				border: "none",
				cursor: "pointer",
				color: "var(--text-secondary)",
				fontSize: 12.5,
				fontWeight: 500,
				fontFamily: "var(--font-display)"
			},
			children: [e, /* @__PURE__ */ (0, x.jsx)(A, {
				path: j.chevronDown,
				size: 14,
				style: {
					transform: r ? "rotate(180deg)" : "none",
					transition: "transform .2s"
				}
			})]
		}), r && /* @__PURE__ */ (0, x.jsx)("div", {
			style: { paddingBottom: 12 },
			children: t
		})]
	});
}
function R({ ok: e }) {
	return /* @__PURE__ */ (0, x.jsx)("span", {
		style: {
			display: "inline-block",
			width: 8,
			height: 8,
			borderRadius: "50%",
			flexShrink: 0,
			background: e ? "var(--brand-500)" : "var(--text-muted)",
			boxShadow: e ? "0 0 0 3px rgba(63,141,104,.15)" : "none"
		},
		title: e ? "מוגדר" : "לא מוגדר"
	});
}
function ae({ value: e, onChange: t, models: n, includeEmbedding: r = !1 }) {
	let i = !e || n.some((t) => t.id === e);
	return /* @__PURE__ */ (0, x.jsxs)(te, {
		value: e,
		onChange: t,
		children: [
			/* @__PURE__ */ (0, x.jsx)("option", {
				value: "",
				children: "— ברירת מחדל —"
			}),
			i ? null : /* @__PURE__ */ (0, x.jsxs)("option", {
				value: e,
				children: [e, " · מוגדר כעת"]
			}),
			n.map((e) => /* @__PURE__ */ (0, x.jsxs)("option", {
				value: e.id,
				children: [e.name || e.id, e.contextLength ? ` · ${Number(e.contextLength).toLocaleString()}` : ""]
			}, e.id))
		]
	});
}
function oe({ form: e, update: t, configStatus: n }) {
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		style: M.section,
		children: [
			/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("p", {
				style: M.sectionTitle,
				children: "OpenRouter"
			}), /* @__PURE__ */ (0, x.jsxs)("div", {
				style: M.card,
				children: [/* @__PURE__ */ (0, x.jsxs)("div", {
					style: {
						display: "flex",
						alignItems: "center",
						gap: 8,
						marginBottom: 14
					},
					children: [/* @__PURE__ */ (0, x.jsx)(R, { ok: n?.openRouter }), /* @__PURE__ */ (0, x.jsx)("span", {
						style: {
							fontSize: 12.5,
							color: "var(--text-secondary)"
						},
						children: n?.openRouter ? "OpenRouter מוגדר" : "OpenRouter לא מוגדר"
					})]
				}), /* @__PURE__ */ (0, x.jsx)(re, {
					label: "OpenRouter API Key",
					value: e.secrets?.openRouterApiKey,
					onChange: (e) => t("secrets.openRouterApiKey", e),
					placeholder: "sk-or-...",
					hint: "השאר ריק כדי לשמור את הערך הקיים"
				})]
			})] }),
			/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("p", {
				style: M.sectionTitle,
				children: "App Supabase"
			}), /* @__PURE__ */ (0, x.jsxs)("div", {
				style: {
					...M.card,
					display: "flex",
					flexDirection: "column",
					gap: 12
				},
				children: [
					/* @__PURE__ */ (0, x.jsxs)("div", {
						style: {
							display: "flex",
							alignItems: "center",
							gap: 8
						},
						children: [/* @__PURE__ */ (0, x.jsx)(R, { ok: n?.supabase }), /* @__PURE__ */ (0, x.jsx)("span", {
							style: {
								fontSize: 12.5,
								color: "var(--text-secondary)"
							},
							children: n?.supabase ? "App Supabase מוגדר" : "App Supabase לא מוגדר"
						})]
					}),
					/* @__PURE__ */ (0, x.jsx)(N, {
						label: "Supabase URL",
						children: /* @__PURE__ */ (0, x.jsx)(I, {
							value: e.secrets?.supabaseUrl,
							onChange: (e) => t("secrets.supabaseUrl", e),
							placeholder: "https://xxxx.supabase.co"
						})
					}),
					/* @__PURE__ */ (0, x.jsx)(re, {
						label: "Service Role Key",
						value: e.secrets?.supabaseServiceRoleKey,
						onChange: (e) => t("secrets.supabaseServiceRoleKey", e),
						placeholder: "eyJ...",
						hint: "השאר ריק כדי לשמור את הערך הקיים"
					})
				]
			})] }),
			/* @__PURE__ */ (0, x.jsxs)(P, { children: [
				"המפתחות נשמרים בטבלת ",
				/* @__PURE__ */ (0, x.jsx)("code", {
					style: {
						background: "var(--surface-2)",
						padding: "1px 5px",
						borderRadius: 4,
						fontSize: 11.5,
						border: "1px solid var(--line)"
					},
					children: "agent_settings"
				}),
				" ב-Supabase. השאר שדות ריקים כדי לשמור את הערכים הקיימים."
			] })
		]
	});
}
function se({ agent: e, models: t, form: n, update: r }) {
	let i = n.models?.[e.key] || "", a = n.prompts?.[e.key] || "", o = n.ai?.[e.key] || {};
	return /* @__PURE__ */ (0, x.jsxs)("article", {
		style: {
			...M.card,
			display: "flex",
			flexDirection: "column",
			gap: 10,
			...e.wide ? { gridColumn: "1 / -1" } : {}
		},
		children: [
			/* @__PURE__ */ (0, x.jsx)("header", {
				style: {
					display: "flex",
					justifyContent: "space-between",
					alignItems: "flex-start"
				},
				children: /* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("strong", {
					style: {
						fontSize: 14,
						color: "var(--text-primary)"
					},
					children: e.label
				}), /* @__PURE__ */ (0, x.jsx)("p", {
					style: {
						...M.hint,
						marginTop: 2
					},
					children: e.desc
				})] })
			}),
			/* @__PURE__ */ (0, x.jsx)(N, {
				label: "מודל",
				children: /* @__PURE__ */ (0, x.jsx)(ae, {
					value: i,
					onChange: (t) => r(`models.${e.key}`, t),
					models: t
				})
			}),
			/* @__PURE__ */ (0, x.jsx)(ie, {
				title: "פרומפט",
				children: /* @__PURE__ */ (0, x.jsx)(ne, {
					value: a,
					rows: e.promptRows,
					onChange: (t) => r(`prompts.${e.key}`, t),
					placeholder: "פרומפט ברירת מחדל — השאר ריק כדי להשתמש בקבוע מ-prompts.js"
				})
			}),
			/* @__PURE__ */ (0, x.jsx)(ie, {
				title: "הגדרות מודל",
				defaultOpen: !0,
				children: /* @__PURE__ */ (0, x.jsxs)("div", {
					style: {
						...M.grid3,
						marginTop: 8
					},
					children: [
						/* @__PURE__ */ (0, x.jsx)(N, {
							label: "Temperature",
							info: w.temperature,
							children: /* @__PURE__ */ (0, x.jsx)(I, {
								type: "number",
								value: o.temperature ?? 0,
								min: 0,
								max: 2,
								step: .05,
								onChange: (t) => r(`ai.${e.key}.temperature`, t)
							})
						}),
						/* @__PURE__ */ (0, x.jsx)(N, {
							label: "Max Tokens",
							info: w.maxTokens,
							children: /* @__PURE__ */ (0, x.jsx)(I, {
								type: "number",
								value: o.maxTokens ?? 4096,
								min: 16,
								max: 32e3,
								step: 50,
								onChange: (t) => r(`ai.${e.key}.maxTokens`, t)
							})
						}),
						/* @__PURE__ */ (0, x.jsx)(N, {
							label: "Timeout (ms)",
							info: w.timeoutMs,
							children: /* @__PURE__ */ (0, x.jsx)(I, {
								type: "number",
								value: o.timeoutMs ?? 9e4,
								min: 5e3,
								max: 18e4,
								step: 1e3,
								onChange: (t) => r(`ai.${e.key}.timeoutMs`, t)
							})
						})
					]
				})
			})
		]
	});
}
function ce({ models: e, form: t, update: n, onRefreshModels: r, modelStatus: i }) {
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		style: M.section,
		children: [/* @__PURE__ */ (0, x.jsxs)("div", {
			style: {
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
				gap: 12,
				flexWrap: "wrap"
			},
			children: [/* @__PURE__ */ (0, x.jsx)(P, { children: "כל מה שמשפיע על תשובות הצ׳אט: מודלים, פרומפטים, הגדרות temperature ו-maxTokens לכל סוכן. השאר שדה ריק כדי להשתמש בפרומפט ברירת המחדל מ-prompts.js." }), /* @__PURE__ */ (0, x.jsxs)("div", {
				style: {
					display: "flex",
					alignItems: "center",
					gap: 10,
					flexShrink: 0
				},
				children: [i && /* @__PURE__ */ (0, x.jsx)("span", {
					style: {
						fontSize: 12,
						color: "var(--text-muted)"
					},
					children: i
				}), /* @__PURE__ */ (0, x.jsxs)(De, {
					onClick: r,
					title: "רענן רשימת מודלים מ-OpenRouter",
					children: [/* @__PURE__ */ (0, x.jsx)(A, {
						path: j.reload,
						size: 14
					}), " רענן מודלים"]
				})]
			})]
		}), /* @__PURE__ */ (0, x.jsx)("div", {
			style: {
				display: "grid",
				gridTemplateColumns: "1fr 1fr",
				gap: 14
			},
			children: C.map((r) => /* @__PURE__ */ (0, x.jsx)(se, {
				agent: r,
				models: e,
				form: t,
				update: n
			}, r.key))
		})]
	});
}
var le = [
	{
		key: "extraction",
		index: "01",
		title: "חילוץ חוזה",
		desc: "קורא את ה־PDF ומחלץ עובדות זמן, אבני דרך, תנאים והשלכות לעיון אנושי.",
		models: [["primaryModel", "מודל ראשי"], ["retryModel", "מודל חלופי"]],
		numbers: [
			[
				"temperature",
				"Temperature",
				0,
				1,
				.05,
				0
			],
			[
				"maxTokens",
				"Max tokens",
				512,
				16e3,
				256,
				4096
			],
			[
				"timeoutMs",
				"Timeout לקריאה (ms)",
				5e3,
				18e4,
				5e3,
				12e4
			],
			[
				"totalBudgetMs",
				"תקציב כולל (ms)",
				3e4,
				6e5,
				1e4,
				27e4
			],
			[
				"concurrency",
				"מקביליות chunks",
				1,
				6,
				1,
				3
			],
			[
				"maxChunkCharacters",
				"מקסימום תווים ל־chunk",
				1200,
				1e4,
				100,
				1e4
			],
			[
				"maxChunkPages",
				"מקסימום עמודים ל־chunk",
				1,
				10,
				1,
				5
			],
			[
				"repairTimeoutMs",
				"Timeout לתיקון (ms)",
				5e3,
				18e4,
				5e3,
				6e4
			]
		],
		prompts: [["systemPrompt", "פרומפט חילוץ ראשי"], ["repairPrompt", "פרומפט תיקון JSON"]]
	},
	{
		key: "enrichment",
		index: "02",
		title: "העשרת סעיפים",
		desc: "מסכם סעיפים מאומתים ומוסיף תגיות מבוקרות לצורך אחזור וחיפוש.",
		models: [["model", "מודל העשרה"]],
		numbers: [
			[
				"temperature",
				"Temperature",
				0,
				1,
				.05,
				0
			],
			[
				"maxTokensPerCall",
				"Tokens לקריאה",
				256,
				1600,
				100,
				1600
			],
			[
				"maxTotalModelTokens",
				"תקציב tokens כולל",
				1600,
				96e3,
				1e3,
				48e3
			],
			[
				"timeoutMs",
				"Timeout לקריאה (ms)",
				5e3,
				18e4,
				5e3,
				75e3
			],
			[
				"totalBudgetMs",
				"תקציב זמן כולל (ms)",
				3e4,
				6e5,
				1e4,
				18e4
			],
			[
				"concurrency",
				"מקביליות",
				1,
				4,
				1,
				2
			],
			[
				"maxRepairBatches",
				"מקסימום תיקוני batch",
				0,
				10,
				1,
				5
			],
			[
				"maxProviderRetries",
				"ניסיונות ספק נוספים",
				0,
				3,
				1,
				1
			]
		],
		prompts: [["systemPrompt", "פרומפט העשרת סעיפים"]]
	},
	{
		key: "relationships",
		index: "03",
		title: "קשרים סמנטיים",
		desc: "מסווג קשרים בין סעיפים ומעביר כל הצעה דרך בודק ספקני נפרד.",
		models: [["model", "מודל מסווג"], ["verifierModel", "מודל בודק"]],
		numbers: [
			[
				"temperature",
				"Temperature",
				0,
				1,
				.05,
				0
			],
			[
				"maxCandidates",
				"מקסימום זוגות",
				1,
				96,
				1,
				48
			],
			[
				"maxTokensPerCall",
				"Tokens למסווג",
				512,
				600,
				10,
				600
			],
			[
				"verifierMaxTokensPerCall",
				"Tokens לבודק",
				350,
				700,
				10,
				700
			],
			[
				"maxTotalModelTokens",
				"תקציב tokens כולל",
				1e3,
				6e4,
				1e3,
				2e4
			],
			[
				"timeoutMs",
				"Timeout לקריאה (ms)",
				5e3,
				18e4,
				5e3,
				75e3
			],
			[
				"totalBudgetMs",
				"תקציב זמן כולל (ms)",
				3e4,
				6e5,
				1e4,
				18e4
			],
			[
				"concurrency",
				"מקביליות",
				1,
				4,
				1,
				2
			],
			[
				"confidenceThreshold",
				"סף ביטחון",
				.5,
				.95,
				.01,
				.9
			],
			[
				"conflictConfidenceThreshold",
				"סף ביטחון לסתירה",
				.5,
				.98,
				.01,
				.9
			],
			[
				"maxProviderRetries",
				"ניסיונות ספק נוספים",
				0,
				3,
				1,
				1
			],
			[
				"maxRepairBatches",
				"תיקוני סיווג",
				0,
				5,
				1,
				1
			],
			[
				"maxVerificationRepairBatches",
				"תיקוני בדיקה",
				0,
				5,
				1,
				1
			]
		],
		prompts: [["systemPrompt", "פרומפט סיווג קשרים"], ["verifierPrompt", "פרומפט בודק קשרים"]]
	},
	{
		key: "decisions",
		index: "04",
		title: "נרמול החלטות",
		desc: "הופך קבוצות מועמדים שנבדקו להצעות החלטה חוזיות עקביות בעברית.",
		models: [["model", "מודל החלטות"]],
		numbers: [
			[
				"temperature",
				"Temperature",
				0,
				1,
				.05,
				0
			],
			[
				"maxTokensPerCall",
				"Tokens לקריאה",
				700,
				2200,
				100,
				1600
			],
			[
				"maxTotalModelTokens",
				"תקציב tokens כולל",
				2200,
				2e5,
				1e3,
				18e4
			],
			[
				"timeoutMs",
				"Timeout לקריאה (ms)",
				5e3,
				18e4,
				5e3,
				75e3
			],
			[
				"totalBudgetMs",
				"תקציב זמן כולל (ms)",
				3e4,
				6e5,
				1e4,
				3e5
			],
			[
				"concurrency",
				"מקביליות",
				1,
				3,
				1,
				3
			],
			[
				"maxProviderRetries",
				"ניסיונות ספק נוספים",
				0,
				1,
				1,
				1
			],
			[
				"maxRepairBatches",
				"מקסימום תיקוני batch",
				0,
				5,
				1,
				3
			],
			[
				"maxSplitFallbackCalls",
				"פיצולי fallback",
				0,
				20,
				1,
				8
			]
		],
		prompts: [["systemPrompt", "פרומפט נרמול החלטות"]]
	},
	{
		key: "autoReview",
		index: "05",
		title: "בדיקה אוטומטית",
		desc: "בודק עצמאי שמאשר רק החלטות העומדות גם במדיניות הדטרמיניסטית.",
		models: [["model", "מודל בודק החלטות"]],
		numbers: [
			[
				"temperature",
				"Temperature",
				0,
				1,
				.05,
				0
			],
			[
				"maxTokens",
				"Max tokens",
				512,
				8e3,
				100,
				3200
			],
			[
				"timeoutMs",
				"Timeout לקריאה (ms)",
				5e3,
				18e4,
				5e3,
				75e3
			],
			[
				"totalBudgetMs",
				"תקציב זמן כולל (ms)",
				3e4,
				6e5,
				1e4,
				3e5
			],
			[
				"batchSize",
				"החלטות בכל batch",
				1,
				12,
				1,
				4
			],
			[
				"concurrency",
				"מקביליות",
				1,
				4,
				1,
				2
			],
			[
				"maxRetries",
				"ניסיונות חוזרים",
				0,
				3,
				1,
				1
			]
		],
		prompts: [["systemPrompt", "פרומפט בודק החלטות"]]
	}
];
function ue({ stage: e, value: t, update: n, models: r }) {
	let i = `contractsAgent.${e.key}`;
	return /* @__PURE__ */ (0, x.jsxs)("article", {
		style: {
			...M.card,
			display: "flex",
			flexDirection: "column",
			gap: 14,
			borderTop: "3px solid var(--brand-500)",
			background: "linear-gradient(180deg, color-mix(in srgb, var(--brand-50) 45%, var(--surface)) 0, var(--surface) 92px)"
		},
		children: [
			/* @__PURE__ */ (0, x.jsxs)("div", {
				style: {
					display: "flex",
					alignItems: "flex-start",
					justifyContent: "space-between",
					gap: 12
				},
				children: [/* @__PURE__ */ (0, x.jsxs)("div", {
					style: {
						display: "flex",
						gap: 11,
						alignItems: "flex-start"
					},
					children: [/* @__PURE__ */ (0, x.jsx)("span", {
						"aria-hidden": "true",
						style: {
							fontSize: 11,
							fontWeight: 800,
							letterSpacing: 1.2,
							color: "var(--brand-600, var(--brand-500))",
							border: "1px solid var(--brand-200, var(--line-strong))",
							borderRadius: 999,
							padding: "3px 7px"
						},
						children: e.index
					}), /* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("h3", {
						style: {
							margin: 0,
							fontSize: 16,
							fontWeight: 780
						},
						children: e.title
					}), /* @__PURE__ */ (0, x.jsx)("p", {
						style: {
							...M.hint,
							marginTop: 5
						},
						children: e.desc
					})] })]
				}), /* @__PURE__ */ (0, x.jsx)(L, {
					label: "פעיל",
					checked: t.enabled !== !1,
					onChange: (e) => n(`${i}.enabled`, e)
				})]
			}),
			/* @__PURE__ */ (0, x.jsx)("div", {
				style: e.models.length > 1 ? M.grid2 : void 0,
				children: e.models.map(([e, a]) => /* @__PURE__ */ (0, x.jsx)(N, {
					label: a,
					children: /* @__PURE__ */ (0, x.jsx)(ae, {
						value: t[e] || "",
						onChange: (t) => n(`${i}.${e}`, t),
						models: r
					})
				}, e))
			}),
			/* @__PURE__ */ (0, x.jsx)(ie, {
				title: "הגדרות מודל ותקציבים",
				defaultOpen: e.key === "extraction",
				children: /* @__PURE__ */ (0, x.jsx)("div", {
					style: {
						display: "grid",
						gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
						gap: 10
					},
					children: e.numbers.map(([e, r, a, o, s, c]) => /* @__PURE__ */ (0, x.jsx)(N, {
						label: r,
						children: /* @__PURE__ */ (0, x.jsx)(I, {
							type: "number",
							min: a,
							max: o,
							step: s,
							value: t[e] ?? c,
							onChange: (t) => n(`${i}.${e}`, t)
						})
					}, e))
				})
			}),
			e.prompts.map(([e, r]) => /* @__PURE__ */ (0, x.jsxs)(ie, {
				title: r,
				children: [/* @__PURE__ */ (0, x.jsx)(ne, {
					rows: 12,
					value: t[e] || "",
					onChange: (t) => n(`${i}.${e}`, t),
					placeholder: "ריק = פרומפט ברירת המחדל המאובטח שבקוד"
				}), /* @__PURE__ */ (0, x.jsx)("p", {
					style: {
						...M.hint,
						marginTop: 6
					},
					children: "הפרומפט נשמר בשרת. השאר ריק כדי לקבל עדכוני ברירת מחדל עתידיים."
				})]
			}, e))
		]
	});
}
function de({ models: e, form: t, update: n, configStatus: r }) {
	let i = t.contractsAgent || {};
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		style: M.section,
		children: [
			/* @__PURE__ */ (0, x.jsxs)("div", {
				style: {
					...M.card,
					padding: "22px 24px",
					display: "grid",
					gridTemplateColumns: "minmax(0, 1fr) auto",
					gap: 20,
					alignItems: "center",
					borderInlineStart: "5px solid var(--brand-500)",
					background: "linear-gradient(115deg, color-mix(in srgb, var(--brand-50) 70%, var(--surface)) 0%, var(--surface) 58%)"
				},
				children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [
					/* @__PURE__ */ (0, x.jsx)("p", {
						style: {
							margin: 0,
							fontSize: 11,
							fontWeight: 800,
							letterSpacing: 1.3,
							color: "var(--brand-600, var(--brand-500))"
						},
						children: "CONTRACTS PIPELINE"
					}),
					/* @__PURE__ */ (0, x.jsx)("h2", {
						style: {
							margin: "5px 0 7px",
							fontSize: 21,
							lineHeight: 1.25
						},
						children: "הגדרות סוכן החוזים"
					}),
					/* @__PURE__ */ (0, x.jsx)("p", {
						style: {
							...M.hint,
							maxWidth: 720
						},
						children: "שליטה מרכזית במודלים, פרומפטים, זמני המתנה ותקציבי הריצה של כל שלבי ניתוח החוזה. מודל ריק יורש את מודל Main או Lite המתאים."
					}),
					/* @__PURE__ */ (0, x.jsxs)("div", {
						style: {
							display: "flex",
							alignItems: "center",
							gap: 8,
							marginTop: 12,
							fontSize: 12.5,
							color: "var(--text-secondary)"
						},
						children: [/* @__PURE__ */ (0, x.jsx)(R, { ok: r?.openRouter }), r?.openRouter ? "OpenRouter מוגדר" : "נדרש מפתח OpenRouter בכרטיסיית חיבורים"]
					})
				] }), /* @__PURE__ */ (0, x.jsx)(L, {
					label: "הפעל סוכן חוזים",
					checked: i.enabled !== !1,
					onChange: (e) => n("contractsAgent.enabled", e)
				})]
			}),
			/* @__PURE__ */ (0, x.jsx)(P, { children: "הגדרות אלה משפיעות רק על קריאות המודל. הרשאות כתיבה, שערי rollout, אימות ראיות והצורך בסקירה אנושית נשארים נעולים ומאומתים בצד השרת." }),
			/* @__PURE__ */ (0, x.jsx)("div", {
				style: {
					display: "grid",
					gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
					gap: 14
				},
				children: le.map((t) => /* @__PURE__ */ (0, x.jsx)(ue, {
					stage: t,
					value: i[t.key] || {},
					update: n,
					models: e
				}, t.key))
			})
		]
	});
}
function fe({ models: e, form: t, update: n }) {
	return e.filter((e) => e.id?.includes("embed") || e.id?.includes("text-embed")), /* @__PURE__ */ (0, x.jsxs)("div", {
		style: M.section,
		children: [
			/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("p", {
				style: M.sectionTitle,
				children: "Embedding & Hybrid Search"
			}), /* @__PURE__ */ (0, x.jsx)("div", {
				style: M.card,
				children: /* @__PURE__ */ (0, x.jsxs)("div", {
					style: {
						...M.grid2,
						gap: 12
					},
					children: [
						/* @__PURE__ */ (0, x.jsx)(N, {
							label: "Embedding Model",
							wide: !0,
							info: w.embeddingModel,
							children: /* @__PURE__ */ (0, x.jsx)(ae, {
								value: t.models?.embedding,
								onChange: (e) => n("models.embedding", e),
								models: e
							})
						}),
						/* @__PURE__ */ (0, x.jsx)(N, {
							label: "Hybrid RPC Name",
							wide: !0,
							info: w.hybridRpcName,
							children: /* @__PURE__ */ (0, x.jsx)(I, {
								value: t.retrieval?.rpcName,
								onChange: (e) => n("retrieval.rpcName", e),
								placeholder: "hybrid_match_data_index_..."
							})
						}),
						/* @__PURE__ */ (0, x.jsx)(N, {
							label: "Hybrid Candidates",
							info: w.hybridCandidates,
							children: /* @__PURE__ */ (0, x.jsx)(I, {
								type: "number",
								value: t.retrieval?.candidates ?? 40,
								min: 1,
								max: 200,
								onChange: (e) => n("retrieval.candidates", e)
							})
						}),
						/* @__PURE__ */ (0, x.jsx)(N, {
							label: "Planner Candidates",
							info: w.plannerCandidates,
							children: /* @__PURE__ */ (0, x.jsx)(I, {
								type: "number",
								value: t.retrieval?.plannerCandidates ?? 20,
								min: 1,
								max: 100,
								onChange: (e) => n("retrieval.plannerCandidates", e)
							})
						}),
						/* @__PURE__ */ (0, x.jsx)(N, {
							label: "Alert Candidates",
							info: w.alertCandidates,
							children: /* @__PURE__ */ (0, x.jsx)(I, {
								type: "number",
								value: t.retrieval?.alertCandidates ?? 20,
								min: 1,
								max: 100,
								onChange: (e) => n("retrieval.alertCandidates", e)
							})
						}),
						/* @__PURE__ */ (0, x.jsx)(N, {
							label: "Reranker Top-K",
							info: w.rerankTopK,
							children: /* @__PURE__ */ (0, x.jsx)(I, {
								type: "number",
								value: t.retrieval?.rerankTopK ?? 10,
								min: 1,
								max: 100,
								onChange: (e) => n("retrieval.rerankTopK", e)
							})
						}),
						/* @__PURE__ */ (0, x.jsx)(N, {
							label: "Vector Weight",
							info: w.vectorWeight,
							children: /* @__PURE__ */ (0, x.jsx)(I, {
								type: "number",
								value: t.retrieval?.vectorWeight ?? .65,
								min: 0,
								max: 1,
								step: .05,
								onChange: (e) => n("retrieval.vectorWeight", e)
							})
						}),
						/* @__PURE__ */ (0, x.jsx)(N, {
							label: "Keyword Weight",
							info: w.keywordWeight,
							children: /* @__PURE__ */ (0, x.jsx)(I, {
								type: "number",
								value: t.retrieval?.keywordWeight ?? .35,
								min: 0,
								max: 1,
								step: .05,
								onChange: (e) => n("retrieval.keywordWeight", e)
							})
						})
					]
				})
			})] }),
			/* @__PURE__ */ (0, x.jsxs)("div", { children: [
				/* @__PURE__ */ (0, x.jsx)("p", {
					style: M.sectionTitle,
					children: "RAG Context"
				}),
				/* @__PURE__ */ (0, x.jsx)(P, { children: "קובע כמה מקורות וכמה טקסט מכל מקור נכנסים בפועל לתשובת ה-AI. השורות מצטמצמות לאורך המשפך: אחזור ראשוני → דירוג מחדש → context שנכנס לסוכן הראשי." }),
				/* @__PURE__ */ (0, x.jsx)("div", {
					style: {
						...M.card,
						marginTop: 10
					},
					children: /* @__PURE__ */ (0, x.jsxs)("div", {
						style: M.grid3,
						children: [
							/* @__PURE__ */ (0, x.jsx)(N, {
								label: "Context Records",
								info: w.ragContextRecordsLimit,
								children: /* @__PURE__ */ (0, x.jsx)(I, {
									type: "number",
									value: t.rag?.contextRecordsLimit ?? 12,
									min: 1,
									max: 50,
									onChange: (e) => n("rag.contextRecordsLimit", e)
								})
							}),
							/* @__PURE__ */ (0, x.jsx)(N, {
								label: "Chunk Text Limit",
								info: w.ragChunkTextLimit,
								children: /* @__PURE__ */ (0, x.jsx)(I, {
									type: "number",
									value: t.rag?.chunkTextLimit ?? 1800,
									min: 100,
									max: 1e4,
									onChange: (e) => n("rag.chunkTextLimit", e)
								})
							}),
							/* @__PURE__ */ (0, x.jsx)(N, {
								label: "Planner Extra Queries",
								info: w.ragPlannerExtraQueriesLimit,
								children: /* @__PURE__ */ (0, x.jsx)(I, {
									type: "number",
									value: t.rag?.plannerExtraQueriesLimit ?? 0,
									min: 0,
									max: 10,
									onChange: (e) => n("rag.plannerExtraQueriesLimit", e)
								})
							})
						]
					})
				})
			] }),
			/* @__PURE__ */ (0, x.jsxs)("div", { children: [
				/* @__PURE__ */ (0, x.jsx)("p", {
					style: M.sectionTitle,
					children: "Graph Context"
				}),
				/* @__PURE__ */ (0, x.jsx)(P, { children: "קובע האם וכמה קשרים מגרף הפרויקט ייכנסו לשאלות RAG — קישורי לוח זמנים, קשרי ישויות ואיתותים." }),
				/* @__PURE__ */ (0, x.jsxs)("div", {
					style: {
						...M.card,
						marginTop: 10,
						display: "flex",
						flexDirection: "column",
						gap: 14
					},
					children: [
						/* @__PURE__ */ (0, x.jsxs)("div", {
							style: M.grid2,
							children: [/* @__PURE__ */ (0, x.jsx)(N, {
								label: "Graph Search Limit",
								info: w.graphSearchLimit,
								children: /* @__PURE__ */ (0, x.jsx)(I, {
									type: "number",
									value: t.graph?.searchLimit ?? 30,
									min: 1,
									max: 100,
									onChange: (e) => n("graph.searchLimit", e)
								})
							}), /* @__PURE__ */ (0, x.jsx)(N, {
								label: "Graph Context Limit",
								info: w.graphContextLimit,
								children: /* @__PURE__ */ (0, x.jsx)(I, {
									type: "number",
									value: t.graph?.contextLimit ?? 12,
									min: 1,
									max: 50,
									onChange: (e) => n("graph.contextLimit", e)
								})
							})]
						}),
						/* @__PURE__ */ (0, x.jsx)(L, {
							label: "להשתמש בגרף בתשובות צ׳אט",
							checked: t.graph?.enabled !== !1,
							onChange: (e) => n("graph.enabled", e),
							info: w.graphEnabled
						}),
						/* @__PURE__ */ (0, x.jsx)(L, {
							label: "להרחיב גרף בשאלות רשימה/חקירה",
							checked: t.graph?.expandedForListQuestions !== !1,
							onChange: (e) => n("graph.expandedForListQuestions", e),
							info: w.graphExpandedForListQuestions
						})
					]
				})
			] }),
			/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("p", {
				style: M.sectionTitle,
				children: "Timeline"
			}), /* @__PURE__ */ (0, x.jsx)("div", {
				style: M.card,
				children: /* @__PURE__ */ (0, x.jsxs)("div", {
					style: M.grid2,
					children: [/* @__PURE__ */ (0, x.jsx)(N, {
						label: "Timeline Limit (rows)",
						info: w.timelineLimit,
						children: /* @__PURE__ */ (0, x.jsx)(I, {
							type: "number",
							value: t.retrieval?.timelineLimit ?? 1e3,
							min: 10,
							max: 1e4,
							onChange: (e) => n("retrieval.timelineLimit", e)
						})
					}), /* @__PURE__ */ (0, x.jsx)(N, {
						label: "Days Back",
						info: w.timelineDaysBack,
						children: /* @__PURE__ */ (0, x.jsx)(I, {
							type: "number",
							value: t.retrieval?.timelineDaysBack ?? 1825,
							min: 1,
							max: 36500,
							onChange: (e) => n("retrieval.timelineDaysBack", e)
						})
					})]
				})
			})] })
		]
	});
}
function pe({ form: e, update: t, configStatus: n }) {
	let r = e.contentSource?.useAppSupabase === !0;
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		style: M.section,
		children: [
			/* @__PURE__ */ (0, x.jsxs)("div", {
				style: {
					display: "flex",
					alignItems: "center",
					gap: 8
				},
				children: [/* @__PURE__ */ (0, x.jsx)(R, { ok: n?.contentSupabase }), /* @__PURE__ */ (0, x.jsx)("span", {
					style: {
						fontSize: 12.5,
						color: "var(--text-secondary)"
					},
					children: n?.contentSupabase ? "APP DATA מוגדר" : "APP DATA לא מוגדר — המערכת תשתמש ב-App Supabase"
				})]
			}),
			/* @__PURE__ */ (0, x.jsxs)("div", {
				style: {
					...M.card,
					display: "flex",
					flexDirection: "column",
					gap: 12
				},
				children: [
					/* @__PURE__ */ (0, x.jsx)(L, {
						label: "השתמש ב-App Supabase של MAIN",
						checked: r,
						onChange: (e) => t("contentSource.useAppSupabase", e)
					}),
					/* @__PURE__ */ (0, x.jsx)(N, {
						label: "APP DATA Supabase URL",
						children: /* @__PURE__ */ (0, x.jsx)(I, {
							value: e.contentSource?.supabaseUrl,
							onChange: (e) => t("contentSource.supabaseUrl", e),
							placeholder: "https://content-project.supabase.co",
							disabled: r
						})
					}),
					/* @__PURE__ */ (0, x.jsx)(re, {
						label: "Service Role Key",
						value: e.contentSource?.supabaseServiceRoleKey,
						onChange: (e) => t("contentSource.supabaseServiceRoleKey", e),
						placeholder: "sb_secret_...",
						disabled: r
					}),
					/* @__PURE__ */ (0, x.jsxs)("div", {
						style: M.grid2,
						children: [
							/* @__PURE__ */ (0, x.jsx)(N, {
								label: "Hybrid RPC Name",
								children: /* @__PURE__ */ (0, x.jsx)(I, {
									value: e.contentSource?.hybridRpcName,
									onChange: (e) => t("contentSource.hybridRpcName", e),
									placeholder: "hybrid_match_data_index..."
								})
							}),
							/* @__PURE__ */ (0, x.jsx)(N, {
								label: "Index Table",
								children: /* @__PURE__ */ (0, x.jsx)(I, {
									value: e.contentSource?.indexTable,
									onChange: (e) => t("contentSource.indexTable", e),
									placeholder: "data_index_embeddings_gf"
								})
							}),
							/* @__PURE__ */ (0, x.jsx)(N, {
								label: "Alerts Table",
								children: /* @__PURE__ */ (0, x.jsx)(I, {
									value: e.contentSource?.alertsTable,
									onChange: (e) => t("contentSource.alertsTable", e),
									placeholder: "alerts_embeddings_gf"
								})
							}),
							/* @__PURE__ */ (0, x.jsx)(N, {
								label: "Alerts RPC Name",
								children: /* @__PURE__ */ (0, x.jsx)(I, {
									value: e.contentSource?.alertsRpcName,
									onChange: (e) => t("contentSource.alertsRpcName", e),
									placeholder: "match_alerts_embeddings_gf"
								})
							})
						]
					})
				]
			}),
			/* @__PURE__ */ (0, x.jsx)(P, { children: "APP DATA הוא פרויקט KAPAIM ב-Supabase ומשמש את כל סוכני המידע, RAG, timeline, alerts ו-Schedule. כשהמתג פעיל, הכתובת והמפתח נלקחים מחיבור App Supabase של MAIN." })
		]
	});
}
function me({ form: e, update: t }) {
	let n = Object.keys(e.tools || {});
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		style: M.section,
		children: [
			/* @__PURE__ */ (0, x.jsx)(P, { children: "כתובת ה-n8n Base URL משמשת בסיס לכל ה-webhooks. כתובות ספציפיות לכלי עוקפות את ה-Base URL עבור אותו כלי בלבד. אם אין שימוש ב-n8n ניתן להשאיר ריק." }),
			/* @__PURE__ */ (0, x.jsx)("div", {
				style: M.card,
				children: /* @__PURE__ */ (0, x.jsx)(N, {
					label: "n8n Base URL",
					hint: "כתובת ה-n8n instance שממנה נקראים ה-webhooks",
					children: /* @__PURE__ */ (0, x.jsx)(I, {
						value: e.n8nBaseUrl,
						onChange: (e) => t("n8nBaseUrl", e),
						placeholder: "https://your-n8n.cloud/webhook"
					})
				})
			}),
			n.length > 0 && /* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("p", {
				style: M.sectionTitle,
				children: "כתובות כלים"
			}), /* @__PURE__ */ (0, x.jsx)("div", {
				style: {
					...M.card,
					display: "flex",
					flexDirection: "column",
					gap: 10
				},
				children: n.map((n) => /* @__PURE__ */ (0, x.jsx)(N, {
					label: n,
					children: /* @__PURE__ */ (0, x.jsx)(I, {
						value: e.tools[n],
						onChange: (e) => t(`tools.${n}`, e),
						placeholder: `Override URL for ${n}`
					})
				}, n))
			})] })
		]
	});
}
function he({ form: e, update: t }) {
	let n = e.memory || {}, [r, i] = (0, b.useState)({
		memoryItems: 0,
		sessions: 0,
		lastUpdatedAt: null,
		mode: "session_only"
	}), [a, o] = (0, b.useState)(""), s = (0, b.useCallback)(() => {
		E("/api/memory/stats").then(i).catch(() => i((e) => ({
			...e,
			degraded: !0
		})));
	}, []);
	(0, b.useEffect)(() => {
		s();
	}, [s]);
	let c = async () => {
		let e = localStorage.getItem("sessionId");
		if (!e) return o("לא נמצאה שיחה נוכחית בדפדפן.");
		if (window.confirm("למחוק את סיכום הזיכרון של השיחה הנוכחית? היסטוריית ההודעות עצמה לא תימחק.")) try {
			await E(`/api/memory/session/${encodeURIComponent(e)}`, { method: "DELETE" }), o("זיכרון השיחה הנוכחית נמחק."), s();
		} catch {
			o("לא נמצא זיכרון שיחה למחיקה או שהמחיקה נכשלה.");
		}
	}, l = async () => {
		if (window.confirm("פעולה זו תמחק את כל הזיכרונות האישיים ואת כל סיכומי השיחות שלך. לא ניתן לבטל אותה. להמשיך?")) {
			if (window.prompt("לאישור סופי, הקלד DELETE_ALL_MEMORY") !== "DELETE_ALL_MEMORY") return o("המחיקה בוטלה — טקסט האישור לא תאם.");
			try {
				await E("/api/memory/me", {
					method: "DELETE",
					body: { confirm: "DELETE_ALL_MEMORY" }
				}), o("כל הזיכרון האישי נמחק."), s();
			} catch {
				o("מחיקת הזיכרון האישי נכשלה.");
			}
		}
	};
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		style: M.section,
		children: [
			/* @__PURE__ */ (0, x.jsxs)("div", {
				style: {
					...M.card,
					borderInlineStart: "4px solid var(--brand-500)"
				},
				children: [/* @__PURE__ */ (0, x.jsx)("p", {
					style: {
						margin: 0,
						fontSize: 14,
						fontWeight: 700
					},
					children: "זיכרון שיחה אינו Cache"
				}), /* @__PURE__ */ (0, x.jsx)("p", {
					style: {
						...M.hint,
						marginTop: 7
					},
					children: "הזיכרון שומר הקשר, סיכומי שיחה והעדפות משתמש ב־Supabase. ה־Cache רק מאיץ פעולות חוזרות, מותר למחיקה בכל רגע ואינו מקור להקשר שיחה."
				})]
			}),
			/* @__PURE__ */ (0, x.jsxs)("div", { children: [
				/* @__PURE__ */ (0, x.jsx)("p", {
					style: M.sectionTitle,
					children: "מצב וסטטיסטיקה"
				}),
				/* @__PURE__ */ (0, x.jsxs)("div", {
					style: { ...M.grid3 },
					children: [
						/* @__PURE__ */ (0, x.jsx)(ge, {
							label: "זיכרונות אישיים",
							value: r.memoryItems ?? 0
						}),
						/* @__PURE__ */ (0, x.jsx)(ge, {
							label: "שיחות עם סיכום",
							value: r.sessions ?? 0
						}),
						/* @__PURE__ */ (0, x.jsx)(ge, {
							label: "עדכון אחרון",
							value: r.lastUpdatedAt ? new Date(r.lastUpdatedAt).toLocaleString("he-IL") : "—"
						})
					]
				}),
				/* @__PURE__ */ (0, x.jsxs)("p", {
					style: {
						...M.hint,
						marginTop: 8
					},
					children: [
						"מצב נוכחי: ",
						r.mode === "user_and_session" ? "זיכרון משתמש + שיחה" : "זיכרון שיחה בלבד",
						r.degraded ? " · שירות הזיכרון לא זמין כרגע" : ""
					]
				})
			] }),
			/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("p", {
				style: M.sectionTitle,
				children: "הגדרות כלליות"
			}), /* @__PURE__ */ (0, x.jsxs)("div", {
				style: {
					...M.card,
					display: "flex",
					flexDirection: "column",
					gap: 14
				},
				children: [
					/* @__PURE__ */ (0, x.jsx)(L, {
						label: "להפעיל זיכרון",
						checked: n.enabled !== !1,
						onChange: (e) => t("memory.enabled", e)
					}),
					/* @__PURE__ */ (0, x.jsx)(L, {
						label: "זיכרון בין שיחות",
						checked: n.crossSessionEnabled !== !1,
						onChange: (e) => t("memory.crossSessionEnabled", e)
					}),
					/* @__PURE__ */ (0, x.jsxs)("div", {
						style: M.grid3,
						children: [
							/* @__PURE__ */ (0, x.jsx)(N, {
								label: "מדיניות כתיבה",
								children: /* @__PURE__ */ (0, x.jsxs)(te, {
									value: n.writePolicy || "hybrid",
									onChange: (e) => t("memory.writePolicy", e),
									children: [
										/* @__PURE__ */ (0, x.jsx)("option", {
											value: "explicit",
											children: "רק בקשת ״זכור״"
										}),
										/* @__PURE__ */ (0, x.jsx)("option", {
											value: "automatic",
											children: "אוטומטית בלבד"
										}),
										/* @__PURE__ */ (0, x.jsx)("option", {
											value: "hybrid",
											children: "היברידית — מומלץ"
										})
									]
								})
							}),
							/* @__PURE__ */ (0, x.jsx)(N, {
								label: "סף למידה אוטומטית",
								children: /* @__PURE__ */ (0, x.jsx)(I, {
									type: "number",
									value: n.autoLearnMinConfidence ?? .85,
									min: 0,
									max: 1,
									step: .01,
									onChange: (e) => t("memory.autoLearnMinConfidence", e)
								})
							}),
							/* @__PURE__ */ (0, x.jsx)(N, {
								label: "רענון סיכום בכל N תורות",
								children: /* @__PURE__ */ (0, x.jsx)(I, {
									type: "number",
									value: n.summaryRefreshEveryTurns ?? 4,
									min: 1,
									max: 50,
									onChange: (e) => t("memory.summaryRefreshEveryTurns", e)
								})
							}),
							/* @__PURE__ */ (0, x.jsx)(N, {
								label: "שמירה (ימים)",
								children: /* @__PURE__ */ (0, x.jsx)(I, {
									type: "number",
									value: n.retentionDays ?? 365,
									min: 1,
									max: 3650,
									onChange: (e) => t("memory.retentionDays", e)
								})
							}),
							/* @__PURE__ */ (0, x.jsx)(N, {
								label: "מקסימום פריטים למשתמש",
								children: /* @__PURE__ */ (0, x.jsx)(I, {
									type: "number",
									value: n.maxItemsPerUser ?? 1e3,
									min: 1,
									max: 1e4,
									onChange: (e) => t("memory.maxItemsPerUser", e)
								})
							}),
							/* @__PURE__ */ (0, x.jsx)(N, {
								label: "תורות ל־Classifier",
								children: /* @__PURE__ */ (0, x.jsx)(I, {
									type: "number",
									value: n.routingRecentTurns ?? 4,
									min: 0,
									max: 20,
									onChange: (e) => t("memory.routingRecentTurns", e)
								})
							}),
							/* @__PURE__ */ (0, x.jsx)(N, {
								label: "תקציב טוקנים לניתוב",
								children: /* @__PURE__ */ (0, x.jsx)(I, {
									type: "number",
									value: n.routingTokenBudget ?? 1200,
									min: 100,
									max: 8e3,
									step: 100,
									onChange: (e) => t("memory.routingTokenBudget", e)
								})
							}),
							/* @__PURE__ */ (0, x.jsx)(N, {
								label: "מודל Embedding",
								children: /* @__PURE__ */ (0, x.jsx)(I, {
									value: "openai/text-embedding-3-large",
									onChange: () => {},
									disabled: !0
								})
							}),
							/* @__PURE__ */ (0, x.jsx)(N, {
								label: "ממדי Embedding",
								children: /* @__PURE__ */ (0, x.jsx)(I, {
									value: "3072",
									onChange: () => {},
									disabled: !0
								})
							})
						]
					})
				]
			})] }),
			/* @__PURE__ */ (0, x.jsxs)("div", {
				style: M.grid2,
				children: [/* @__PURE__ */ (0, x.jsx)(_e, {
					agent: "main",
					title: "Main Agent",
					memory: n,
					update: t
				}), /* @__PURE__ */ (0, x.jsx)(_e, {
					agent: "lite",
					title: "Lite Agent",
					memory: n,
					update: t
				})]
			}),
			/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("p", {
				style: M.sectionTitle,
				children: "מחיקת נתונים"
			}), /* @__PURE__ */ (0, x.jsxs)("div", {
				style: {
					...M.card,
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					flexWrap: "wrap",
					gap: 12
				},
				children: [
					/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("p", {
						style: {
							margin: 0,
							fontWeight: 700,
							fontSize: 13
						},
						children: "שליטה בזיכרון האישי"
					}), /* @__PURE__ */ (0, x.jsx)("p", {
						style: {
							...M.hint,
							marginTop: 5
						},
						children: "מחיקת session אינה מוחקת הודעות. מחיקה מלאה מסירה זיכרונות אישיים וסיכומי שיחות."
					})] }),
					/* @__PURE__ */ (0, x.jsxs)("div", {
						style: {
							display: "flex",
							gap: 8,
							flexWrap: "wrap"
						},
						children: [/* @__PURE__ */ (0, x.jsx)(De, {
							onClick: c,
							children: "מחק זיכרון שיחה נוכחית"
						}), /* @__PURE__ */ (0, x.jsx)(De, {
							variant: "danger",
							onClick: l,
							children: "מחק את כל הזיכרון שלי"
						})]
					}),
					a && /* @__PURE__ */ (0, x.jsx)("p", {
						role: "status",
						style: {
							...M.hint,
							width: "100%"
						},
						children: a
					})
				]
			})] })
		]
	});
}
function ge({ label: e, value: t }) {
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		style: {
			...M.card,
			padding: "14px 16px"
		},
		children: [/* @__PURE__ */ (0, x.jsx)("p", {
			style: {
				...M.hint,
				marginBottom: 5
			},
			children: e
		}), /* @__PURE__ */ (0, x.jsx)("strong", {
			style: {
				fontSize: 18,
				fontWeight: 750
			},
			children: t
		})]
	});
}
function _e({ agent: e, title: t, memory: n, update: r }) {
	let i = n.agents?.[e] || {}, a = `memory.agents.${e}`, o = Number(i.semanticWeight || 0) + Number(i.recencyWeight || 0) + Number(i.importanceWeight || 0);
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		style: {
			...M.card,
			display: "flex",
			flexDirection: "column",
			gap: 14
		},
		children: [
			/* @__PURE__ */ (0, x.jsxs)("div", {
				style: {
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					gap: 10
				},
				children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("p", {
					style: {
						margin: 0,
						fontSize: 15,
						fontWeight: 750
					},
					children: t
				}), /* @__PURE__ */ (0, x.jsx)("p", {
					style: {
						...M.hint,
						marginTop: 3
					},
					children: "תקציב ושליפה עצמאיים"
				})] }), /* @__PURE__ */ (0, x.jsx)(L, {
					label: "פעיל",
					checked: i.enabled !== !1,
					onChange: (e) => r(`${a}.enabled`, e)
				})]
			}),
			/* @__PURE__ */ (0, x.jsxs)("div", {
				style: M.grid2,
				children: [
					/* @__PURE__ */ (0, x.jsx)(N, {
						label: "Recent Turns",
						children: /* @__PURE__ */ (0, x.jsx)(I, {
							type: "number",
							value: i.recentTurns ?? (e === "main" ? 6 : 8),
							min: 0,
							max: 30,
							onChange: (e) => r(`${a}.recentTurns`, e)
						})
					}),
					/* @__PURE__ */ (0, x.jsx)(N, {
						label: "Context Token Budget",
						children: /* @__PURE__ */ (0, x.jsx)(I, {
							type: "number",
							value: i.contextTokenBudget ?? (e === "main" ? 3e3 : 4e3),
							min: 200,
							max: 16e3,
							step: 100,
							onChange: (e) => r(`${a}.contextTokenBudget`, e)
						})
					}),
					/* @__PURE__ */ (0, x.jsx)(N, {
						label: "Semantic Top K",
						children: /* @__PURE__ */ (0, x.jsx)(I, {
							type: "number",
							value: i.semanticTopK ?? (e === "main" ? 6 : 4),
							min: 0,
							max: 30,
							onChange: (e) => r(`${a}.semanticTopK`, e)
						})
					}),
					/* @__PURE__ */ (0, x.jsx)(N, {
						label: "Similarity Threshold",
						children: /* @__PURE__ */ (0, x.jsx)(I, {
							type: "number",
							value: i.similarityThreshold ?? (e === "main" ? .72 : .7),
							min: 0,
							max: 1,
							step: .01,
							onChange: (e) => r(`${a}.similarityThreshold`, e)
						})
					}),
					/* @__PURE__ */ (0, x.jsx)(N, {
						label: "Semantic Weight",
						children: /* @__PURE__ */ (0, x.jsx)(I, {
							type: "number",
							value: i.semanticWeight ?? (e === "main" ? .7 : .65),
							min: 0,
							max: 1,
							step: .05,
							onChange: (e) => r(`${a}.semanticWeight`, e)
						})
					}),
					/* @__PURE__ */ (0, x.jsx)(N, {
						label: "Recency Weight",
						children: /* @__PURE__ */ (0, x.jsx)(I, {
							type: "number",
							value: i.recencyWeight ?? (e === "main" ? .15 : .2),
							min: 0,
							max: 1,
							step: .05,
							onChange: (e) => r(`${a}.recencyWeight`, e)
						})
					}),
					/* @__PURE__ */ (0, x.jsx)(N, {
						label: "Importance Weight",
						children: /* @__PURE__ */ (0, x.jsx)(I, {
							type: "number",
							value: i.importanceWeight ?? .15,
							min: 0,
							max: 1,
							step: .05,
							onChange: (e) => r(`${a}.importanceWeight`, e)
						})
					})
				]
			}),
			/* @__PURE__ */ (0, x.jsx)(L, {
				label: "להשתמש בסיכום שיחה",
				checked: i.useSessionSummary !== !1,
				onChange: (e) => r(`${a}.useSessionSummary`, e)
			}),
			/* @__PURE__ */ (0, x.jsx)(L, {
				label: "להשתמש בזיכרון ארוך טווח",
				checked: i.useLongTermMemory !== !1,
				onChange: (e) => r(`${a}.useLongTermMemory`, e)
			}),
			/* @__PURE__ */ (0, x.jsxs)("p", {
				style: {
					...M.hint,
					color: Math.abs(o - 1) < .001 ? "var(--text-muted)" : "var(--danger)"
				},
				children: [
					"סכום משקלים: ",
					o.toFixed(2),
					Math.abs(o - 1) < .001 ? "" : " — מומלץ שסכום המשקלים יהיה 1.00"
				]
			})
		]
	});
}
function ve({ form: e, update: t }) {
	let n = e.toolsRuntime || {}, r = e.ai?.alert || {}, i = e.cache || {}, a = i.provider || "memory";
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		style: M.section,
		children: [
			/* @__PURE__ */ (0, x.jsx)(P, { children: "שולט בהפעלת כלים חיצוניים, סוכן ההתראות וה-Cache — בלי לשנות את כתובות ה-webhooks." }),
			/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("p", {
				style: M.sectionTitle,
				children: "כלי N8N — ריצה"
			}), /* @__PURE__ */ (0, x.jsxs)("div", {
				style: {
					...M.card,
					display: "flex",
					flexDirection: "column",
					gap: 14
				},
				children: [
					/* @__PURE__ */ (0, x.jsx)(L, {
						label: "להפעיל כלי N8N",
						checked: n.enabled !== !1,
						onChange: (e) => t("toolsRuntime.enabled", e),
						info: w.toolsEnabled
					}),
					/* @__PURE__ */ (0, x.jsx)(L, {
						label: "להפעיל Alert Agent",
						checked: n.alertAgentEnabled !== !1,
						onChange: (e) => t("toolsRuntime.alertAgentEnabled", e),
						info: w.toolsAlertAgentEnabled
					}),
					/* @__PURE__ */ (0, x.jsx)(L, {
						label: "להפעיל בדיקת בטיחות מוקדמת",
						checked: n.safetyPrecheckEnabled !== !1,
						onChange: (e) => t("toolsRuntime.safetyPrecheckEnabled", e),
						info: w.toolsSafetyPrecheckEnabled
					}),
					/* @__PURE__ */ (0, x.jsx)(N, {
						label: "Parallel Tool Calls Limit",
						info: w.toolsParallelLimit,
						children: /* @__PURE__ */ (0, x.jsx)(I, {
							type: "number",
							value: n.parallelLimit ?? 6,
							min: 1,
							max: 20,
							onChange: (e) => t("toolsRuntime.parallelLimit", e)
						})
					})
				]
			})] }),
			/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("p", {
				style: M.sectionTitle,
				children: "סוכן Alert — הגדרות מודל"
			}), /* @__PURE__ */ (0, x.jsx)("div", {
				style: { ...M.card },
				children: /* @__PURE__ */ (0, x.jsxs)("div", {
					style: M.grid3,
					children: [
						/* @__PURE__ */ (0, x.jsx)(N, {
							label: "Temperature",
							info: w.alertTemperature,
							children: /* @__PURE__ */ (0, x.jsx)(I, {
								type: "number",
								value: r.temperature ?? 0,
								min: 0,
								max: 2,
								step: .05,
								onChange: (e) => t("ai.alert.temperature", e)
							})
						}),
						/* @__PURE__ */ (0, x.jsx)(N, {
							label: "Max Tokens",
							info: w.alertMaxTokens,
							children: /* @__PURE__ */ (0, x.jsx)(I, {
								type: "number",
								value: r.maxTokens ?? 4096,
								min: 16,
								max: 32e3,
								step: 50,
								onChange: (e) => t("ai.alert.maxTokens", e)
							})
						}),
						/* @__PURE__ */ (0, x.jsx)(N, {
							label: "Timeout (ms)",
							info: w.alertTimeoutMs,
							children: /* @__PURE__ */ (0, x.jsx)(I, {
								type: "number",
								value: r.timeoutMs ?? 9e4,
								min: 5e3,
								max: 18e4,
								step: 1e3,
								onChange: (e) => t("ai.alert.timeoutMs", e)
							})
						})
					]
				})
			})] }),
			/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("p", {
				style: M.sectionTitle,
				children: "Cache"
			}), /* @__PURE__ */ (0, x.jsxs)("div", {
				style: {
					...M.card,
					display: "flex",
					flexDirection: "column",
					gap: 14
				},
				children: [
					/* @__PURE__ */ (0, x.jsx)(L, {
						label: "להפעיל Cache",
						checked: i.enabled !== !1,
						onChange: (e) => t("cache.enabled", e),
						info: w.cacheEnabled
					}),
					/* @__PURE__ */ (0, x.jsxs)("div", {
						style: M.grid2,
						children: [/* @__PURE__ */ (0, x.jsx)(N, {
							label: "Cache Provider",
							info: w.cacheProvider,
							children: /* @__PURE__ */ (0, x.jsxs)(te, {
								value: a,
								onChange: (e) => t("cache.provider", e),
								children: [
									/* @__PURE__ */ (0, x.jsx)("option", {
										value: "memory",
										children: "Memory — פיתוח"
									}),
									/* @__PURE__ */ (0, x.jsx)("option", {
										value: "redis",
										children: "Redis — Production"
									}),
									/* @__PURE__ */ (0, x.jsx)("option", {
										value: "none",
										children: "ללא Cache"
									})
								]
							})
						}), /* @__PURE__ */ (0, x.jsx)(N, {
							label: "Memory Max Entries",
							info: w.cacheMemoryMaxEntries,
							children: /* @__PURE__ */ (0, x.jsx)(I, {
								type: "number",
								value: i.memoryMaxEntries ?? 1e4,
								min: 100,
								max: 1e6,
								step: 100,
								onChange: (e) => t("cache.memoryMaxEntries", e)
							})
						})]
					}),
					/* @__PURE__ */ (0, x.jsx)(re, {
						label: "Redis URL",
						value: i.redisUrl,
						onChange: (e) => t("cache.redisUrl", e),
						placeholder: "redis://default:password@host:6379",
						hint: "השאר ריק כדי לשמור את הערך הקיים",
						info: w.cacheRedisUrl
					})
				]
			})] })
		]
	});
}
function ye({ form: e, onApplyPreset: t, onSavePreset: n }) {
	let [r, i] = (0, b.useState)(""), [a, o] = (0, b.useState)(""), s = e.presets || [], c = s.find((e) => e.name === r);
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		style: M.section,
		children: [
			/* @__PURE__ */ (0, x.jsx)(P, { children: "בחירה מהירה של תצורות מוכנות. טעינת פריסט מעדכנת את הטופס בלבד — לחץ \"שמור\" כדי לכתוב ל-Supabase." }),
			/* @__PURE__ */ (0, x.jsxs)("div", {
				style: M.card,
				children: [/* @__PURE__ */ (0, x.jsx)("p", {
					style: M.sectionTitle,
					children: "בחר פריסט"
				}), /* @__PURE__ */ (0, x.jsxs)("div", {
					style: {
						display: "flex",
						flexDirection: "column",
						gap: 10
					},
					children: [
						/* @__PURE__ */ (0, x.jsxs)(te, {
							value: r,
							onChange: i,
							children: [/* @__PURE__ */ (0, x.jsx)("option", {
								value: "",
								children: "— בחר פריסט —"
							}), s.map((e) => /* @__PURE__ */ (0, x.jsx)("option", {
								value: e.name,
								children: e.name
							}, e.name))]
						}),
						c && /* @__PURE__ */ (0, x.jsx)("p", {
							style: {
								...M.hint,
								background: "var(--surface-3)",
								padding: "8px 12px",
								borderRadius: "var(--r)",
								border: "1px solid var(--line)"
							},
							children: c.description || "אין תיאור לפריסט זה."
						}),
						/* @__PURE__ */ (0, x.jsx)(De, {
							onClick: () => r && t(r),
							disabled: !r,
							children: "טען פריסט"
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, x.jsxs)("div", {
				style: M.card,
				children: [/* @__PURE__ */ (0, x.jsx)("p", {
					style: M.sectionTitle,
					children: "שמור פריסט חדש"
				}), /* @__PURE__ */ (0, x.jsxs)("div", {
					style: {
						display: "flex",
						gap: 8
					},
					children: [/* @__PURE__ */ (0, x.jsx)(I, {
						value: a,
						onChange: o,
						placeholder: "שם לפריסט חדש..."
					}), /* @__PURE__ */ (0, x.jsx)(De, {
						variant: "primary",
						disabled: !a.trim(),
						style: { whiteSpace: "nowrap" },
						onClick: () => {
							a.trim() && (n(a.trim()), o(""));
						},
						children: "שמור"
					})]
				})]
			})
		]
	});
}
function be({ form: e, update: t }) {
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		style: M.section,
		children: [
			/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("p", {
				style: M.sectionTitle,
				children: "אזור זמן"
			}), /* @__PURE__ */ (0, x.jsx)("div", {
				style: M.card,
				children: /* @__PURE__ */ (0, x.jsx)(N, {
					label: "אזור זמן",
					hint: "אזור הזמן משפיע על כל שאלות הזמן שנשאלות בסוכן",
					children: /* @__PURE__ */ (0, x.jsx)(te, {
						value: e.timezone,
						onChange: (e) => t("timezone", e),
						children: T.map((e) => /* @__PURE__ */ (0, x.jsx)("option", {
							value: e,
							children: e
						}, e))
					})
				})
			})] }),
			/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("p", {
				style: M.sectionTitle,
				children: "Knowledge Base Vocabulary"
			}), /* @__PURE__ */ (0, x.jsx)("div", {
				style: M.card,
				children: /* @__PURE__ */ (0, x.jsx)(N, {
					label: "מילות מפתח שמפעילות את Knowledge Base Agent",
					hint: "כאשר אחת מהמילים מופיעה בשאלת המשתמש, המערכת תפעיל את Professional Knowledge Agent",
					children: /* @__PURE__ */ (0, x.jsx)(ne, {
						value: e.knowledge?.triggerKeywords,
						rows: 6,
						onChange: (e) => t("knowledge.triggerKeywords", e),
						placeholder: "חסמים\nסיכונים\nתלויות"
					})
				})
			})] }),
			/* @__PURE__ */ (0, x.jsxs)("div", { children: [
				/* @__PURE__ */ (0, x.jsx)("p", {
					style: M.sectionTitle,
					children: "Knowledge Base — הגדרות מתקדמות"
				}),
				/* @__PURE__ */ (0, x.jsx)(P, { children: "שולט בכמה ידע מקומי נכנס לתכנון החיפוש המקצועי." }),
				/* @__PURE__ */ (0, x.jsx)("div", {
					style: {
						...M.card,
						marginTop: 10
					},
					children: /* @__PURE__ */ (0, x.jsxs)("div", {
						style: M.grid3,
						children: [
							/* @__PURE__ */ (0, x.jsx)(N, {
								label: "Knowledge Agent Limit",
								info: w.knowledgeAgentLimit,
								children: /* @__PURE__ */ (0, x.jsx)(I, {
									type: "number",
									value: e.knowledge?.agentLimit ?? 2,
									min: 1,
									max: 5,
									onChange: (e) => t("knowledge.agentLimit", e)
								})
							}),
							/* @__PURE__ */ (0, x.jsx)(N, {
								label: "Knowledge Top K",
								info: w.knowledgeTopK,
								children: /* @__PURE__ */ (0, x.jsx)(I, {
									type: "number",
									value: e.knowledge?.topK ?? 4,
									min: 1,
									max: 20,
									onChange: (e) => t("knowledge.topK", e)
								})
							}),
							/* @__PURE__ */ (0, x.jsx)(N, {
								label: "Knowledge Chunk Size",
								info: w.knowledgeChunkSize,
								children: /* @__PURE__ */ (0, x.jsx)(I, {
									type: "number",
									value: e.knowledge?.chunkSize ?? 1800,
									min: 300,
									max: 6e3,
									step: 100,
									onChange: (e) => t("knowledge.chunkSize", e)
								})
							})
						]
					})
				})
			] })
		]
	});
}
var xe = [
	{
		key: "timeFilter",
		label: "מסנן קשר לזמן",
		desc: "שכבה מקדימה לבדיקה קבוצתית בלבד; דילוג בטוח על התראות שאינן קשורות לזמן או ללו״ז."
	},
	{
		key: "extractor",
		label: "חילוץ אירוע",
		desc: "ממיר את ההתראה למבנה עובדתי קשיח."
	},
	{
		key: "matcher",
		label: "התאמה מקצועית",
		desc: "בודק התאמה לתחום, מיקום וסוג העבודה."
	},
	{
		key: "validator",
		label: "בקרת לוח זמנים",
		desc: "בודק תאריכים, היררכיה וסתירות בלו״ז."
	},
	{
		key: "judge",
		label: "שופט",
		desc: "מופעל רק בעמימות, מחלוקת או קרבה לסף."
	},
	{
		key: "embedding",
		label: "Embeddings",
		desc: "מוסיף דירוג סמנטי למועמדים הראשונים."
	}
], Se = [
	["lexical", "חיפוש מילולי"],
	["semantic", "חיפוש סמנטי"],
	["temporal", "התאמה בזמן"],
	["hierarchy", "היררכיית Gantt"],
	["historical", "שיוכים מאושרים קודמים"],
	["projectRag", "RAG פרויקטלי (ניסיוני)"]
], Ce = [
	["semantic", "סמנטיקה"],
	["lexical", "מילים"],
	["temporal", "זמן"],
	["hierarchy", "היררכיה"],
	["historical", "היסטוריה"],
	["modelConsensus", "הסכמת מודלים"]
];
function we(e) {
	if (!e) return "טרם פורסם";
	let t = new Date(e);
	return Number.isNaN(t.getTime()) ? String(e) : new Intl.DateTimeFormat("he-IL", {
		dateStyle: "medium",
		timeStyle: "short"
	}).format(t);
}
function z(e) {
	let t = String(e || "");
	if (!t) return "לא זמין";
	let n = t.includes(":") ? t.slice(t.lastIndexOf(":") + 1) : t;
	return n.length > 18 ? `${n.slice(0, 10)}…${n.slice(-6)}` : n;
}
function Te({ form: e, update: t, models: n, scheduleAgentMeta: r }) {
	let i = e.scheduleAssignmentAgent || {}, [a, o] = (0, b.useState)(null), [s, c] = (0, b.useState)({
		projectId: "",
		sourceId: "",
		busy: !1,
		result: null,
		error: ""
	}), l = Object.values(i.weights || {}).reduce((e, t) => e + (Number(t) || 0), 0), u = r?.persisted ? "פורסם ב-Supabase" : "ברירת מחדל מהקוד", d = async () => {
		try {
			o(await E("/api/settings/schedule-assignment-agent/validate", {
				method: "POST",
				body: { settings: i }
			}));
		} catch {
			o({
				ok: !1,
				errors: ["בדיקת ההגדרה נכשלה בשרת."],
				warnings: []
			});
		}
	}, f = async () => {
		c((e) => ({
			...e,
			busy: !0,
			result: null,
			error: ""
		}));
		try {
			let e = await E("/api/settings/schedule-assignment-agent/dry-run", {
				method: "POST",
				body: {
					projectId: s.projectId.trim(),
					sourceId: s.sourceId.trim()
				}
			});
			c((t) => ({
				...t,
				busy: !1,
				result: e
			}));
		} catch {
			c((e) => ({
				...e,
				busy: !1,
				error: "ה־dry-run נכשל. שמור קודם את ההגדרות ובדוק שהפרויקט וההתראה קיימים."
			}));
		}
	};
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		style: M.section,
		children: [
			/* @__PURE__ */ (0, x.jsxs)("div", {
				"data-schedule-agent-publication": !0,
				style: {
					...M.card,
					display: "grid",
					gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
					gap: 14,
					borderColor: r?.persisted ? "var(--success-border)" : "var(--warning-border, var(--line))",
					background: r?.persisted ? "var(--success-bg)" : "var(--surface-2)"
				},
				children: [
					/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("small", {
						style: M.hint,
						children: "סטטוס פעיל"
					}), /* @__PURE__ */ (0, x.jsx)("strong", {
						style: {
							display: "block",
							marginTop: 4
						},
						children: u
					})] }),
					/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("small", {
						style: M.hint,
						children: "גרסת פרומפטים"
					}), /* @__PURE__ */ (0, x.jsx)("strong", {
						dir: "ltr",
						style: {
							display: "block",
							marginTop: 4,
							textAlign: "right",
							overflowWrap: "anywhere"
						},
						children: i.version || "לא הוגדרה"
					})] }),
					/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("small", {
						style: M.hint,
						children: "פורסם לאחרונה"
					}), /* @__PURE__ */ (0, x.jsx)("strong", {
						style: {
							display: "block",
							marginTop: 4
						},
						children: we(i.publishedAt)
					})] }),
					/* @__PURE__ */ (0, x.jsxs)("div", {
						title: r?.snapshotId || "",
						children: [/* @__PURE__ */ (0, x.jsx)("small", {
							style: M.hint,
							children: "Configuration snapshot"
						}), /* @__PURE__ */ (0, x.jsx)("strong", {
							dir: "ltr",
							style: {
								display: "block",
								marginTop: 4,
								textAlign: "right"
							},
							children: z(r?.snapshotId)
						})]
					})
				]
			}),
			/* @__PURE__ */ (0, x.jsx)(P, { children: "זהו מנגנון מבוקר לכל שורה. בריצה קבוצתית ניתן להפעיל מסנן זמן מקדים; לחיצה ידנית על שורה תמיד מריצה את התהליך המלא. המודלים מציעים ומנמקים בלבד ורכיב המדיניות בשרת הוא היחיד שרשאי לכתוב קשר." }),
			/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("p", {
				style: M.sectionTitle,
				children: "הפעלה והכרעה"
			}), /* @__PURE__ */ (0, x.jsxs)("div", {
				style: {
					...M.card,
					display: "flex",
					flexDirection: "column",
					gap: 16
				},
				children: [/* @__PURE__ */ (0, x.jsxs)("div", {
					style: {
						display: "flex",
						flexWrap: "wrap",
						gap: 22
					},
					children: [/* @__PURE__ */ (0, x.jsx)(L, {
						label: "הפעל סוכן שיוך",
						checked: i.enabled !== !1,
						onChange: (e) => t("scheduleAssignmentAgent.enabled", e)
					}), /* @__PURE__ */ (0, x.jsx)(L, {
						label: "אפשר שיוך אוטומטי לאחר לחיצה",
						checked: i.autoAssignmentEnabled === !0,
						onChange: (e) => t("scheduleAssignmentAgent.autoAssignmentEnabled", e)
					})]
				}), /* @__PURE__ */ (0, x.jsxs)("div", {
					style: M.grid3,
					children: [
						/* @__PURE__ */ (0, x.jsx)(N, {
							label: "סף הסתברות מכוילת לשיוך (%)",
							hint: Number(i.autoAssignmentThreshold) < 85 ? "אזהרה: סף נמוך מ־85% מגדיל סיכון לשיוך שגוי. הסף אינו פעיל ללא ארטיפקט כיול תקף." : "ברירת המחדל: 90%. הסף אינו פעיל ללא ארטיפקט כיול תקף.",
							children: /* @__PURE__ */ (0, x.jsx)(I, {
								type: "number",
								min: 50,
								max: 100,
								value: i.autoAssignmentThreshold ?? 90,
								onChange: (e) => t("scheduleAssignmentAgent.autoAssignmentThreshold", e)
							})
						}),
						/* @__PURE__ */ (0, x.jsx)(N, {
							label: "פער מהמועמד השני",
							hint: "ברירת המחדל: 12 נקודות.",
							children: /* @__PURE__ */ (0, x.jsx)(I, {
								type: "number",
								min: 0,
								max: 100,
								value: i.minimumRunnerUpMargin ?? 12,
								onChange: (e) => t("scheduleAssignmentAgent.minimumRunnerUpMargin", e)
							})
						}),
						/* @__PURE__ */ (0, x.jsx)(N, {
							label: "סף להצגת הצעה",
							children: /* @__PURE__ */ (0, x.jsx)(I, {
								type: "number",
								min: 0,
								max: 100,
								value: i.suggestionThreshold ?? 45,
								onChange: (e) => t("scheduleAssignmentAgent.suggestionThreshold", e)
							})
						}),
						/* @__PURE__ */ (0, x.jsx)(N, {
							label: "סף ביטחון לדילוג במסנן זמן (%)",
							hint: "רק תשובת „לא קשור לזמן” מעל סף זה תדלג על ההתראה. כשל או ספק ממשיכים לבדיקה המלאה.",
							children: /* @__PURE__ */ (0, x.jsx)(I, {
								type: "number",
								min: 50,
								max: 100,
								value: i.timeFilterConfidenceThreshold ?? 80,
								onChange: (e) => t("scheduleAssignmentAgent.timeFilterConfidenceThreshold", e)
							})
						}),
						/* @__PURE__ */ (0, x.jsx)(N, {
							label: "טווח קרוב לסף להפעלת שופט",
							children: /* @__PURE__ */ (0, x.jsx)(I, {
								type: "number",
								min: 0,
								max: 30,
								value: i.judgeNearThresholdRange ?? 8,
								onChange: (e) => t("scheduleAssignmentAgent.judgeNearThresholdRange", e)
							})
						}),
						/* @__PURE__ */ (0, x.jsx)(N, {
							label: "מקסימום מועמדים",
							children: /* @__PURE__ */ (0, x.jsx)(I, {
								type: "number",
								min: 2,
								max: 50,
								value: i.maxCandidates ?? 20,
								onChange: (e) => t("scheduleAssignmentAgent.maxCandidates", e)
							})
						}),
						/* @__PURE__ */ (0, x.jsx)(N, {
							label: "מקסימום קריאות Chat",
							children: /* @__PURE__ */ (0, x.jsx)(I, {
								type: "number",
								min: 0,
								max: 8,
								value: i.maxModelCalls ?? 4,
								onChange: (e) => t("scheduleAssignmentAgent.maxModelCalls", e)
							})
						})
					]
				})]
			})] }),
			/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("p", {
				style: M.sectionTitle,
				children: "מודלים ופרומפטים"
			}), /* @__PURE__ */ (0, x.jsx)("div", {
				style: {
					display: "grid",
					gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
					gap: 12
				},
				children: xe.map((e) => {
					let r = i.roles?.[e.key] || {}, a = e.key === "embedding";
					return /* @__PURE__ */ (0, x.jsxs)("div", {
						style: {
							...M.card,
							display: "flex",
							flexDirection: "column",
							gap: 12
						},
						children: [
							/* @__PURE__ */ (0, x.jsxs)("div", { children: [
								/* @__PURE__ */ (0, x.jsx)(L, {
									label: e.label,
									checked: r.enabled !== !1,
									onChange: (n) => t(`scheduleAssignmentAgent.roles.${e.key}.enabled`, n)
								}),
								/* @__PURE__ */ (0, x.jsx)("p", {
									style: {
										...M.hint,
										marginTop: 6
									},
									children: e.desc
								}),
								a ? null : /* @__PURE__ */ (0, x.jsxs)("div", {
									dir: "ltr",
									style: {
										display: "flex",
										flexWrap: "wrap",
										gap: 6,
										marginTop: 8,
										justifyContent: "flex-end"
									},
									children: [/* @__PURE__ */ (0, x.jsxs)("code", {
										style: {
											fontSize: 10.5,
											padding: "3px 7px",
											borderRadius: 999,
											background: "var(--surface-2)",
											border: "1px solid var(--line)"
										},
										children: ["role: ", r.instructionRole || "system"]
									}), /* @__PURE__ */ (0, x.jsxs)("code", {
										style: {
											fontSize: 10.5,
											padding: "3px 7px",
											borderRadius: 999,
											background: "var(--surface-2)",
											border: "1px solid var(--line)"
										},
										children: [
											r.schemaName || "schema unavailable",
											" · v",
											r.schemaVersion || "?"
										]
									})]
								})
							] }),
							/* @__PURE__ */ (0, x.jsx)(N, {
								label: "מודל",
								children: /* @__PURE__ */ (0, x.jsx)(ae, {
									value: r.model || "",
									onChange: (n) => t(`scheduleAssignmentAgent.roles.${e.key}.model`, n),
									models: n,
									includeEmbedding: a
								})
							}),
							a ? /* @__PURE__ */ (0, x.jsx)(N, {
								label: "מספר מועמדים לחישוב embedding",
								children: /* @__PURE__ */ (0, x.jsx)(I, {
									type: "number",
									min: 1,
									max: 20,
									value: r.candidateLimit ?? 8,
									onChange: (n) => t(`scheduleAssignmentAgent.roles.${e.key}.candidateLimit`, n)
								})
							}) : /* @__PURE__ */ (0, x.jsxs)(x.Fragment, { children: [/* @__PURE__ */ (0, x.jsxs)("div", {
								style: M.grid2,
								children: [/* @__PURE__ */ (0, x.jsx)(N, {
									label: "Temperature",
									children: /* @__PURE__ */ (0, x.jsx)(I, {
										type: "number",
										min: 0,
										max: 1,
										step: .1,
										value: r.temperature ?? 0,
										onChange: (n) => t(`scheduleAssignmentAgent.roles.${e.key}.temperature`, n)
									})
								}), /* @__PURE__ */ (0, x.jsx)(N, {
									label: "Max tokens",
									children: /* @__PURE__ */ (0, x.jsx)(I, {
										type: "number",
										min: 100,
										max: 8e3,
										step: 100,
										value: r.maxTokens ?? 1200,
										onChange: (n) => t(`scheduleAssignmentAgent.roles.${e.key}.maxTokens`, n)
									})
								})]
							}), /* @__PURE__ */ (0, x.jsx)(ie, {
								title: "עריכת פרומפט",
								children: /* @__PURE__ */ (0, x.jsx)(ne, {
									dir: "ltr",
									style: {
										textAlign: "left",
										fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace"
									},
									rows: 18,
									value: r.prompt || "",
									onChange: (n) => t(`scheduleAssignmentAgent.roles.${e.key}.prompt`, n)
								})
							})] })
						]
					}, e.key);
				})
			})] }),
			/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("p", {
				style: M.sectionTitle,
				children: "כלי חיפוש ומשקלי ציון"
			}), /* @__PURE__ */ (0, x.jsxs)("div", {
				style: {
					...M.card,
					display: "flex",
					flexDirection: "column",
					gap: 18
				},
				children: [
					/* @__PURE__ */ (0, x.jsx)("div", {
						style: {
							display: "grid",
							gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
							gap: 12
						},
						children: Se.map(([e, n]) => /* @__PURE__ */ (0, x.jsx)(L, {
							label: n,
							checked: i.tools?.[e] === !0,
							onChange: (n) => t(`scheduleAssignmentAgent.tools.${e}`, n)
						}, e))
					}),
					/* @__PURE__ */ (0, x.jsxs)("div", {
						style: {
							borderTop: "1px solid var(--line)",
							paddingTop: 16
						},
						children: [/* @__PURE__ */ (0, x.jsxs)("div", {
							style: {
								display: "flex",
								justifyContent: "space-between",
								gap: 12,
								marginBottom: 10
							},
							children: [/* @__PURE__ */ (0, x.jsx)("strong", {
								style: { fontSize: 13 },
								children: "משקלים"
							}), /* @__PURE__ */ (0, x.jsxs)("span", {
								style: {
									fontSize: 12,
									color: l === 100 ? "var(--success-text)" : "var(--error-text)"
								},
								children: [
									"סה״כ ",
									l,
									"% ",
									l === 100 ? "✓" : "— נדרש 100%"
								]
							})]
						}), /* @__PURE__ */ (0, x.jsx)("div", {
							style: M.grid3,
							children: Ce.map(([e, n]) => /* @__PURE__ */ (0, x.jsx)(N, {
								label: `${n} (%)`,
								children: /* @__PURE__ */ (0, x.jsx)(I, {
									type: "number",
									min: 0,
									max: 100,
									value: i.weights?.[e] ?? 0,
									onChange: (n) => t(`scheduleAssignmentAgent.weights.${e}`, n)
								})
							}, e))
						})]
					}),
					/* @__PURE__ */ (0, x.jsx)(De, {
						onClick: d,
						children: "בדוק הגדרה"
					}),
					a ? /* @__PURE__ */ (0, x.jsxs)("div", {
						role: "status",
						style: {
							fontSize: 12.5,
							lineHeight: 1.7,
							color: a.ok ? "var(--success-text)" : "var(--error-text)"
						},
						children: [a.ok ? "ההגדרה תקינה." : (a.errors || []).join(" "), (a.warnings || []).map((e) => /* @__PURE__ */ (0, x.jsxs)("div", {
							style: { color: "var(--warning-text, #9a6700)" },
							children: ["⚠ ", e]
						}, e))]
					}) : null
				]
			})] }),
			/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("p", {
				style: M.sectionTitle,
				children: "מעבדת Dry-run"
			}), /* @__PURE__ */ (0, x.jsxs)("div", {
				style: {
					...M.card,
					display: "flex",
					flexDirection: "column",
					gap: 12
				},
				children: [
					/* @__PURE__ */ (0, x.jsx)(P, { children: "המעבדה משתמשת רק בהגדרה השמורה בשרת ולעולם אינה כותבת שיוך. שמור את הטיוטה לפני הבדיקה." }),
					/* @__PURE__ */ (0, x.jsxs)("div", {
						style: M.grid2,
						children: [/* @__PURE__ */ (0, x.jsx)(N, {
							label: "Project ID",
							children: /* @__PURE__ */ (0, x.jsx)(I, {
								value: s.projectId,
								onChange: (e) => c((t) => ({
									...t,
									projectId: e
								}))
							})
						}), /* @__PURE__ */ (0, x.jsx)(N, {
							label: "Alert source ID",
							children: /* @__PURE__ */ (0, x.jsx)(I, {
								value: s.sourceId,
								onChange: (e) => c((t) => ({
									...t,
									sourceId: e
								}))
							})
						})]
					}),
					/* @__PURE__ */ (0, x.jsx)(De, {
						variant: "primary",
						disabled: s.busy || !s.projectId.trim() || !s.sourceId.trim(),
						onClick: f,
						children: s.busy ? "מריץ…" : "הרץ ללא כתיבה"
					}),
					s.error ? /* @__PURE__ */ (0, x.jsx)("div", {
						style: {
							color: "var(--error-text)",
							fontSize: 12.5
						},
						children: s.error
					}) : null,
					s.result ? /* @__PURE__ */ (0, x.jsxs)("div", {
						role: "status",
						style: {
							background: "var(--surface-2)",
							border: "1px solid var(--line)",
							borderRadius: "var(--r)",
							padding: 12,
							fontSize: 12.5,
							lineHeight: 1.7
						},
						children: [
							/* @__PURE__ */ (0, x.jsx)("strong", { children: s.result.decision?.selectedActivityName || "לא נמצאה פעילות חד־משמעית" }),
							/* @__PURE__ */ (0, x.jsxs)("div", { children: [
								"ציון התאמה: ",
								s.result.decision?.rankingScore ?? s.result.decision?.confidence ?? 0,
								` · פער: ${s.result.decision?.rankingGap ?? s.result.decision?.margin ?? 0}`,
								Number.isFinite(s.result.decision?.calibratedProbability) ? ` · הסתברות מכוילת: ${Math.round(s.result.decision.calibratedProbability * 100)}%` : "",
								` · החלטה: ${s.result.decision?.type}`
							] }),
							/* @__PURE__ */ (0, x.jsx)("div", { children: s.result.decision?.reason })
						]
					}) : null
				]
			})] })
		]
	});
}
function Ee(e = "secondary", t = !1) {
	let n = {
		display: "inline-flex",
		alignItems: "center",
		gap: 6,
		padding: "7px 14px",
		borderRadius: "var(--r)",
		border: "none",
		cursor: t ? "default" : "pointer",
		fontFamily: "var(--font-display)",
		fontSize: 13,
		fontWeight: 500,
		transition: "all .15s",
		opacity: t ? .5 : 1
	};
	return e === "primary" ? {
		...n,
		background: "var(--brand-500)",
		color: "#fff",
		boxShadow: "0 1px 2px rgba(63,141,104,.25)"
	} : e === "danger" ? {
		...n,
		background: "var(--danger)",
		color: "#fff"
	} : {
		...n,
		background: "var(--surface-3)",
		color: "var(--text-primary)",
		border: "1px solid var(--line-strong)"
	};
}
function De({ variant: e = "secondary", disabled: t = !1, onClick: n, children: r, title: i, style: a }) {
	let [o, s] = (0, b.useState)(!1), c = Ee(e, t), l = !t && o ? e === "primary" ? {
		background: "var(--brand-600, #2f7355)",
		boxShadow: "0 3px 10px rgba(63,141,104,.34)",
		transform: "translateY(-1px)"
	} : e === "danger" ? {
		filter: "brightness(.92)",
		transform: "translateY(-1px)"
	} : {
		background: "var(--surface-2)",
		borderColor: "var(--brand-500)",
		color: "var(--brand-600, var(--brand-500))"
	} : {};
	return /* @__PURE__ */ (0, x.jsx)("button", {
		type: "button",
		onClick: n,
		disabled: t,
		title: i,
		onMouseEnter: () => s(!0),
		onMouseLeave: () => s(!1),
		style: {
			...c,
			...l,
			...a
		},
		children: r
	});
}
function Oe({ sec: e, isActive: t, onSelect: n }) {
	let [r, i] = (0, b.useState)(!1);
	return /* @__PURE__ */ (0, x.jsxs)("button", {
		onClick: () => n(e.id),
		onMouseEnter: () => i(!0),
		onMouseLeave: () => i(!1),
		style: {
			position: "relative",
			display: "flex",
			alignItems: "center",
			gap: 10,
			padding: "9px 12px",
			borderRadius: "var(--r)",
			border: "none",
			background: t ? "var(--brand-50)" : r ? "var(--surface-2)" : "transparent",
			color: t ? "var(--brand-600, var(--brand-500))" : "var(--text-secondary)",
			fontWeight: t ? 700 : 500,
			fontSize: 13.5,
			cursor: "pointer",
			textAlign: "right",
			fontFamily: "var(--font-display)",
			transition: "all .15s",
			width: "100%"
		},
		children: [
			t && /* @__PURE__ */ (0, x.jsx)("span", { style: {
				position: "absolute",
				insetInlineEnd: 0,
				top: "50%",
				transform: "translateY(-50%)",
				width: 3,
				height: 18,
				borderRadius: 3,
				background: "var(--brand-500)"
			} }),
			/* @__PURE__ */ (0, x.jsx)(A, {
				path: j[e.id] || j.general,
				size: 16,
				style: {
					color: t ? "var(--brand-500)" : "var(--text-muted)",
					flexShrink: 0
				}
			}),
			e.label
		]
	});
}
function ke({ active: e, onSelect: t }) {
	return /* @__PURE__ */ (0, x.jsx)("nav", {
		style: {
			width: 188,
			flexShrink: 0,
			display: "flex",
			flexDirection: "column",
			gap: 3,
			position: "sticky",
			top: 0,
			alignSelf: "flex-start",
			background: "var(--surface)",
			border: "1px solid var(--line)",
			borderRadius: "var(--r-xl)",
			padding: 8,
			boxShadow: "0 1px 4px rgba(0,0,0,.04)"
		},
		children: S.map((n) => /* @__PURE__ */ (0, x.jsx)(Oe, {
			sec: n,
			isActive: n.id === e,
			onSelect: t
		}, n.id))
	});
}
function Ae({ saveState: e, onSave: t, onReload: n, onExport: r, onImport: i, fileRef: a }) {
	let o = e === "saving", s = e === "saved", c = e === "error";
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		style: {
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between",
			paddingBottom: 16,
			borderBottom: "1px solid var(--line)",
			marginBottom: 20,
			gap: 12,
			flexWrap: "wrap"
		},
		children: [/* @__PURE__ */ (0, x.jsxs)("div", {
			style: {
				display: "flex",
				alignItems: "center",
				gap: 10
			},
			children: [
				/* @__PURE__ */ (0, x.jsx)("h2", {
					style: {
						margin: 0,
						fontSize: 18,
						fontWeight: 700,
						color: "var(--text-primary)"
					},
					children: "הגדרות"
				}),
				s && /* @__PURE__ */ (0, x.jsxs)("span", {
					style: {
						display: "inline-flex",
						alignItems: "center",
						gap: 4,
						fontSize: 12,
						color: "var(--success-text)",
						background: "var(--success-bg)",
						padding: "3px 9px",
						borderRadius: 20,
						border: "1px solid var(--success-border)"
					},
					children: [/* @__PURE__ */ (0, x.jsx)(A, {
						path: j.check,
						size: 11
					}), " נשמר"]
				}),
				c && /* @__PURE__ */ (0, x.jsxs)("span", {
					style: {
						display: "inline-flex",
						alignItems: "center",
						gap: 4,
						fontSize: 12,
						color: "var(--error-text)",
						background: "var(--error-bg)",
						padding: "3px 9px",
						borderRadius: 20,
						border: "1px solid var(--error-border)"
					},
					children: [/* @__PURE__ */ (0, x.jsx)(A, {
						path: j.warning,
						size: 11
					}), " שגיאה בשמירה"]
				})
			]
		}), /* @__PURE__ */ (0, x.jsxs)("div", {
			style: {
				display: "flex",
				gap: 8,
				alignItems: "center"
			},
			children: [
				/* @__PURE__ */ (0, x.jsxs)(De, {
					onClick: n,
					title: "רענן מ-Supabase",
					children: [/* @__PURE__ */ (0, x.jsx)(A, {
						path: j.reload,
						size: 14
					}), " רענן"]
				}),
				/* @__PURE__ */ (0, x.jsxs)(De, {
					onClick: r,
					title: "הורד קובץ הגדרות",
					children: [/* @__PURE__ */ (0, x.jsx)(A, {
						path: j.download,
						size: 14
					}), " ייצוא"]
				}),
				/* @__PURE__ */ (0, x.jsxs)("label", {
					style: {
						...Ee("secondary"),
						cursor: "pointer"
					},
					title: "טען קובץ הגדרות",
					children: [
						/* @__PURE__ */ (0, x.jsx)(A, {
							path: j.upload,
							size: 14
						}),
						" ייבוא",
						/* @__PURE__ */ (0, x.jsx)("input", {
							ref: a,
							type: "file",
							accept: ".json",
							hidden: !0,
							onChange: i
						})
					]
				}),
				/* @__PURE__ */ (0, x.jsxs)(De, {
					variant: "primary",
					onClick: t,
					disabled: o,
					children: [/* @__PURE__ */ (0, x.jsx)(A, {
						path: j.save,
						size: 14
					}), o ? "שומר..." : "שמור"]
				})
			]
		})]
	});
}
function je({ label: e, ok: t, detail: n }) {
	return /* @__PURE__ */ (0, x.jsxs)("span", {
		style: {
			display: "inline-flex",
			alignItems: "center",
			gap: 5
		},
		children: [
			/* @__PURE__ */ (0, x.jsx)("span", { style: {
				width: 7,
				height: 7,
				borderRadius: "50%",
				background: t === !0 ? "#22c55e" : t === !1 ? "#ef4444" : "#94a3b8",
				flexShrink: 0
			} }),
			/* @__PURE__ */ (0, x.jsxs)("span", {
				style: {
					fontWeight: 600,
					color: "var(--text-primary)"
				},
				children: [e, ":"]
			}),
			/* @__PURE__ */ (0, x.jsx)("span", {
				style: { color: t === !1 ? "#ef4444" : "var(--text-secondary, var(--text-muted))" },
				children: t === !0 ? "מוגדר" : t === !1 ? "לא מוגדר" : n
			}),
			n && t !== void 0 && /* @__PURE__ */ (0, x.jsxs)("span", {
				style: {
					color: "var(--text-muted)",
					fontSize: 11
				},
				children: [
					"(",
					n,
					")"
				]
			})
		]
	});
}
function Me({ configStatus: e, form: t, saveState: n }) {
	let r = t.contentSource || {}, i = r.supabaseUrl ? r.supabaseUrl.replace(/^https?:\/\//, "").split(".")[0] : null, a = n === "saved", o = n === "error", s = n === "saving";
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		style: {
			display: "flex",
			flexWrap: "wrap",
			alignItems: "center",
			gap: "6px 0",
			padding: "9px 14px",
			background: "var(--surface-2)",
			border: "1px solid var(--line)",
			borderRadius: "var(--r)",
			marginBottom: 18,
			fontSize: 12,
			fontFamily: "var(--font-display)",
			lineHeight: 1.4
		},
		children: [
			/* @__PURE__ */ (0, x.jsx)(je, {
				label: "OpenRouter",
				ok: e.openRouter
			}),
			/* @__PURE__ */ (0, x.jsx)(Ne, {}),
			/* @__PURE__ */ (0, x.jsx)(je, {
				label: "App DB",
				ok: e.supabase
			}),
			/* @__PURE__ */ (0, x.jsx)(Ne, {}),
			/* @__PURE__ */ (0, x.jsx)(je, {
				label: "APP DATA",
				ok: e.contentSupabase,
				detail: i
			}),
			r.hybridRpcName && /* @__PURE__ */ (0, x.jsxs)(x.Fragment, { children: [/* @__PURE__ */ (0, x.jsx)(Ne, {}), /* @__PURE__ */ (0, x.jsx)(je, {
				label: "Content RPC",
				detail: r.hybridRpcName
			})] }),
			(r.indexTable || r.alertsTable) && /* @__PURE__ */ (0, x.jsxs)(x.Fragment, { children: [/* @__PURE__ */ (0, x.jsx)(Ne, {}), /* @__PURE__ */ (0, x.jsx)(je, {
				label: "Tables",
				detail: [r.indexTable, r.alertsTable].filter(Boolean).join(", ")
			})] }),
			/* @__PURE__ */ (0, x.jsx)("span", { style: {
				marginRight: "auto",
				paddingRight: 4
			} }),
			s && /* @__PURE__ */ (0, x.jsx)("span", {
				style: {
					color: "var(--text-muted)",
					fontSize: 11
				},
				children: "שומר..."
			}),
			a && /* @__PURE__ */ (0, x.jsx)("span", {
				style: {
					color: "#22c55e",
					fontSize: 11,
					fontWeight: 600
				},
				children: "✓ נשמר בהצלחה"
			}),
			o && /* @__PURE__ */ (0, x.jsx)("span", {
				style: {
					color: "#ef4444",
					fontSize: 11,
					fontWeight: 600
				},
				children: "✗ שגיאה בשמירה"
			}),
			!s && !a && !o && /* @__PURE__ */ (0, x.jsx)("span", {
				style: {
					color: "var(--text-muted)",
					fontSize: 11
				},
				children: "ההגדרות נטענו מ-Supabase"
			})
		]
	});
}
function Ne() {
	return /* @__PURE__ */ (0, x.jsx)("span", {
		style: {
			color: "var(--line-strong, #cbd5e1)",
			margin: "0 8px"
		},
		children: "|"
	});
}
function B() {
	let [e, t] = (0, b.useState)({}), [n, r] = (0, b.useState)([]), [i, a] = (0, b.useState)(!0), [o, s] = (0, b.useState)("connections"), [c, l] = (0, b.useState)("idle"), [u, d] = (0, b.useState)({}), [f, p] = (0, b.useState)(""), [m, h] = (0, b.useState)({
		persisted: !1,
		snapshotId: ""
	}), g = (0, b.useRef)(null);
	(0, b.useEffect)(() => {
		Promise.all([
			E("/api/settings").catch(() => null),
			E("/api/openrouter/models").catch(() => ({ models: [] })),
			E("/api/settings/schedule-assignment-agent").catch(() => null)
		]).then(([e, n, i]) => {
			let o = e?.settings ?? e, s = o ? {
				...o,
				...i?.settings ? { scheduleAssignmentAgent: i.settings } : {}
			} : null;
			s && (t(O(s)), h({
				persisted: i?.persisted === !0,
				snapshotId: i?.snapshotId || o?.scheduleAssignmentAgent?.snapshotId || ""
			}), d({
				openRouter: s.openRouterConfigured,
				supabase: s.supabaseConfigured,
				contentSupabase: s.contentSupabaseConfigured
			})), r(n?.models || []), a(!1);
		});
	}, []);
	let _ = (0, b.useCallback)((e, n) => {
		t((t) => D(t, e, n)), l("idle");
	}, []), v = async () => {
		l("saving");
		try {
			let n = await E("/api/settings", {
				method: "PUT",
				body: k(e)
			});
			if (n?.settings) {
				d({
					openRouter: n.settings.openRouterConfigured,
					supabase: n.settings.supabaseConfigured,
					contentSupabase: n.settings.contentSupabaseConfigured
				});
				let e = await E("/api/settings/schedule-assignment-agent").catch(() => null);
				e?.settings && (t(O({
					...n.settings,
					scheduleAssignmentAgent: e.settings
				})), h({
					persisted: e.persisted === !0,
					snapshotId: e.snapshotId || ""
				}));
			}
			l("saved"), setTimeout(() => l("idle"), 3e3);
		} catch {
			l("error");
		}
	}, y = async () => {
		try {
			let e = await E("/api/settings/reload", {
				method: "POST",
				body: {}
			});
			if (e?.settings) {
				let n = await E("/api/settings/schedule-assignment-agent").catch(() => null);
				t(O({
					...e.settings,
					...n?.settings ? { scheduleAssignmentAgent: n.settings } : {}
				})), h({
					persisted: n?.persisted === !0,
					snapshotId: n?.snapshotId || e.settings.scheduleAssignmentAgent?.snapshotId || ""
				}), d({
					openRouter: e.settings.openRouterConfigured,
					supabase: e.settings.supabaseConfigured,
					contentSupabase: e.settings.contentSupabaseConfigured
				}), l("saved"), setTimeout(() => l("idle"), 2e3);
			}
		} catch {}
	}, S = async () => {
		try {
			let e = await E("/api/settings/export"), t = new Blob([JSON.stringify(e, null, 2)], { type: "application/json" }), n = document.createElement("a");
			n.href = URL.createObjectURL(t), n.download = "bidoc-settings.json", n.click();
		} catch {}
	}, C = async (e) => {
		let n = e.target.files?.[0];
		if (!n) return;
		let r = await n.text();
		try {
			let e = await E("/api/settings/import", {
				method: "POST",
				body: JSON.parse(r)
			});
			e?.settings && t(O(e.settings));
		} catch {}
		g.current && (g.current.value = "");
	}, w = async (e) => {
		try {
			let n = await E("/api/settings/preset/apply", {
				method: "POST",
				body: { name: e }
			});
			n?.settings && t(O(n.settings));
		} catch {}
	}, T = async (t) => {
		try {
			await E("/api/settings/preset", {
				method: "POST",
				body: {
					name: t,
					settings: k(e)
				}
			});
		} catch {}
	}, A = async () => {
		p("טוען רשימת מודלים מ-OpenRouter...");
		try {
			let e = await E("/api/openrouter/models");
			r(e?.models || []), p(`נטענו ${e?.models?.length || 0} מודלים`), setTimeout(() => p(""), 3e3);
		} catch {
			p("שגיאה בטעינת מודלים");
		}
	};
	if (i) return /* @__PURE__ */ (0, x.jsx)("div", {
		style: {
			padding: 40,
			textAlign: "center",
			color: "var(--text-muted)",
			fontFamily: "var(--font-display)"
		},
		children: "טוען הגדרות..."
	});
	let j = {
		form: e,
		update: _,
		models: n,
		configStatus: u,
		scheduleAgentMeta: m
	};
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		dir: "rtl",
		style: {
			fontFamily: "var(--font-display)",
			color: "var(--text-primary)"
		},
		children: [
			/* @__PURE__ */ (0, x.jsx)("style", { children: "\n        @keyframes bidocFade { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }\n        @media (prefers-reduced-motion: reduce) {\n          [data-react-island=\"settings\"] * { animation-duration: .001ms !important; transition-duration: .001ms !important; }\n        }\n        @media (max-width: 720px) {\n          [data-bidoc-settings-layout] { flex-direction: column !important; }\n          [data-bidoc-settings-layout] > nav { width: 100% !important; flex-direction: row !important; overflow-x: auto; }\n        }\n      " }),
			/* @__PURE__ */ (0, x.jsx)(Ae, {
				saveState: c,
				onSave: v,
				onReload: y,
				onExport: S,
				onImport: C,
				fileRef: g
			}),
			/* @__PURE__ */ (0, x.jsx)(Me, {
				configStatus: u,
				form: e,
				saveState: c
			}),
			/* @__PURE__ */ (0, x.jsxs)("div", {
				"data-bidoc-settings-layout": !0,
				style: {
					display: "flex",
					gap: 28,
					alignItems: "flex-start"
				},
				children: [/* @__PURE__ */ (0, x.jsx)(ke, {
					active: o,
					onSelect: s
				}), /* @__PURE__ */ (0, x.jsxs)("div", {
					style: {
						flex: 1,
						minWidth: 0,
						animation: "bidocFade .18s ease-out"
					},
					children: [
						o === "connections" && /* @__PURE__ */ (0, x.jsx)(oe, { ...j }),
						o === "agents" && /* @__PURE__ */ (0, x.jsx)(ce, {
							...j,
							onRefreshModels: A,
							modelStatus: f
						}),
						o === "contractsAgent" && /* @__PURE__ */ (0, x.jsx)(de, { ...j }),
						o === "scheduleAgent" && /* @__PURE__ */ (0, x.jsx)(Te, { ...j }),
						o === "retrieval" && /* @__PURE__ */ (0, x.jsx)(fe, { ...j }),
						o === "content" && /* @__PURE__ */ (0, x.jsx)(pe, { ...j }),
						o === "tools" && /* @__PURE__ */ (0, x.jsx)(me, { ...j }),
						o === "memory" && /* @__PURE__ */ (0, x.jsx)(he, { ...j }),
						o === "performance" && /* @__PURE__ */ (0, x.jsx)(ve, { ...j }),
						o === "presets" && /* @__PURE__ */ (0, x.jsx)(ye, {
							...j,
							onApplyPreset: w,
							onSavePreset: T
						}),
						o === "general" && /* @__PURE__ */ (0, x.jsx)(be, { ...j })
					]
				}, o)]
			})
		]
	});
}
//#endregion
//#region src/react/WorkflowPage.jsx
var Pe = ({ path: e, size: t = 16, strokeWidth: n = 2, ...r }) => /* @__PURE__ */ (0, x.jsx)("svg", {
	width: t,
	height: t,
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: n,
	strokeLinecap: "round",
	strokeLinejoin: "round",
	...r,
	children: Array.isArray(e) ? e.map((e, t) => /* @__PURE__ */ (0, x.jsx)("path", { d: e }, t)) : /* @__PURE__ */ (0, x.jsx)("path", { d: e })
}), Fe = {
	report: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8",
	log: "M4 6h16M4 12h16M4 18h10",
	copy: "M9 9h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2zM5 15H4a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1",
	clear: "M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
}, Ie = [
	{
		id: "tokens",
		valueId: "wfMetric_totalTokens",
		subId: "wfMetricSub_totalTokens",
		title: "Total Tokens",
		value: "0",
		icon: ["M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"]
	},
	{
		id: "cost",
		valueId: "wfMetric_totalCost",
		subId: "wfMetricSub_totalCost",
		title: "Total Cost",
		value: "$0.0000",
		icon: ["M12 1v22", "M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"]
	},
	{
		id: "latency",
		valueId: "wfMetric_latency",
		subId: "wfMetricSub_latency",
		title: "Latency (P95)",
		value: "0.00s",
		icon: ["M12 22A10 10 0 1 0 12 2a10 10 0 0 0 0 20z", "M12 6v6l4 2"]
	},
	{
		id: "cacheHitRate",
		valueId: "wfMetric_cacheHitRate",
		subId: "wfMetricSub_cacheHitRate",
		title: "Cache Hit Rate",
		value: "0%",
		icon: ["M23 4v6h-6", "M20.49 15a9 9 0 1 1-2.12-9.36L23 10"]
	},
	{
		id: "cache",
		valueId: "wfMetric_cache",
		subId: "wfMetricSub_cache",
		title: "Cache",
		value: "HIT / MISS",
		icon: [
			"M12 8c5 0 9-1.34 9-3s-4-3-9-3-9 1.34-9 3 4 3 9 3z",
			"M21 12c0 1.66-4 3-9 3s-9-1.34-9-3",
			"M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"
		]
	},
	{
		id: "successRate",
		valueId: "wfMetric_successRate",
		subId: "wfMetricSub_successRate",
		title: "Success Rate",
		value: "100%",
		icon: ["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"]
	}
], Le = [
	{
		id: "overview",
		label: "סקירה"
	},
	{
		id: "filters",
		label: "פילטר"
	},
	{
		id: "events",
		label: "אירועים"
	},
	{
		id: "logs",
		label: "לוגים"
	},
	{
		id: "metrics",
		label: "מדדים"
	}
];
function Re({ m: e }) {
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		className: "metricCard",
		id: `metricCard_${e.id}`,
		children: [/* @__PURE__ */ (0, x.jsx)("span", {
			className: "metricIcon",
			children: /* @__PURE__ */ (0, x.jsx)(Pe, {
				path: e.icon,
				size: 18
			})
		}), /* @__PURE__ */ (0, x.jsxs)("div", {
			className: "metricContent",
			children: [
				/* @__PURE__ */ (0, x.jsx)("span", {
					className: "metricTitle",
					children: e.title
				}),
				/* @__PURE__ */ (0, x.jsx)("strong", {
					className: "metricValue",
					id: e.valueId,
					children: e.value
				}),
				/* @__PURE__ */ (0, x.jsx)("span", {
					className: "metricSub",
					id: e.subId,
					children: "—"
				})
			]
		})]
	});
}
function ze() {
	return (0, b.useEffect)(() => {
		window.__bidocWorkflowMounted = !0;
		let e = 0, t = null, n = () => {
			if (typeof window.__bidocInitWorkflow == "function") {
				window.__bidocInitWorkflow();
				return;
			}
			e++ < 60 && (t = setTimeout(n, 50));
		};
		return n(), () => {
			t && clearTimeout(t);
		};
	}, []), /* @__PURE__ */ (0, x.jsxs)("div", {
		className: "wfShell",
		dir: "rtl",
		children: [/* @__PURE__ */ (0, x.jsxs)("header", {
			className: "wfHeader",
			children: [/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "wfHeaderTitle",
				children: [/* @__PURE__ */ (0, x.jsx)("h2", { children: "זרימת עבודה" }), /* @__PURE__ */ (0, x.jsx)("p", {
					className: "wfHeaderSub",
					children: "תצוגת הרכיבים, הקווים והלוגים של ההרצה האחרונה — בזמן אמת."
				})]
			}), /* @__PURE__ */ (0, x.jsxs)("div", {
				className: "wfHeaderActions",
				children: [
					/* @__PURE__ */ (0, x.jsxs)("button", {
						id: "runAiReport",
						type: "button",
						className: "wfBtn wfBtnPrimary",
						children: [/* @__PURE__ */ (0, x.jsx)(Pe, {
							path: Fe.report,
							size: 15
						}), " דוח AI"]
					}),
					/* @__PURE__ */ (0, x.jsxs)("button", {
						id: "toggleFullLog",
						type: "button",
						className: "wfBtn",
						children: [/* @__PURE__ */ (0, x.jsx)(Pe, {
							path: Fe.log,
							size: 15
						}), " לוג מלא"]
					}),
					/* @__PURE__ */ (0, x.jsxs)("button", {
						id: "copyLog",
						type: "button",
						className: "wfBtn",
						children: [/* @__PURE__ */ (0, x.jsx)(Pe, {
							path: Fe.copy,
							size: 15
						}), " העתק"]
					}),
					/* @__PURE__ */ (0, x.jsxs)("button", {
						id: "clearWorkflow",
						type: "button",
						className: "wfBtn wfBtnDanger",
						children: [/* @__PURE__ */ (0, x.jsx)(Pe, {
							path: Fe.clear,
							size: 15
						}), " נקה"]
					})
				]
			})]
		}), /* @__PURE__ */ (0, x.jsxs)("div", {
			className: "workflowLayout",
			children: [/* @__PURE__ */ (0, x.jsxs)("aside", {
				className: "runHistoryStrip",
				id: "runHistoryStrip",
				children: [/* @__PURE__ */ (0, x.jsx)("div", {
					className: "runHistoryStripHeader",
					children: "היסטוריית ריצות"
				}), /* @__PURE__ */ (0, x.jsx)("div", {
					className: "runHistoryList",
					id: "runHistoryList",
					children: /* @__PURE__ */ (0, x.jsx)("div", {
						className: "runHistoryEmpty",
						children: "אין ריצות שמורות"
					})
				})]
			}), /* @__PURE__ */ (0, x.jsxs)("div", {
				className: "workflowMain",
				children: [
					/* @__PURE__ */ (0, x.jsxs)("section", {
						className: "liveRun collapsed",
						id: "liveRun",
						children: [
							/* @__PURE__ */ (0, x.jsxs)("header", {
								id: "liveRunHeader",
								style: {
									cursor: "pointer",
									userSelect: "none"
								},
								children: [/* @__PURE__ */ (0, x.jsxs)("div", {
									style: {
										display: "flex",
										alignItems: "center",
										gap: 8
									},
									children: [/* @__PURE__ */ (0, x.jsx)("svg", {
										id: "liveRunChevron",
										width: "14",
										height: "14",
										viewBox: "0 0 24 24",
										fill: "none",
										stroke: "currentColor",
										strokeWidth: "2.5",
										strokeLinecap: "round",
										strokeLinejoin: "round",
										style: {
											transition: "transform 0.2s",
											flexShrink: 0
										},
										children: /* @__PURE__ */ (0, x.jsx)("polyline", { points: "9 18 15 12 9 6" })
									}), /* @__PURE__ */ (0, x.jsx)("strong", { children: "לוג ריצה חי" })]
								}), /* @__PURE__ */ (0, x.jsx)("span", {
									id: "liveRunStatus",
									children: "ממתין לבקשה"
								})]
							}),
							/* @__PURE__ */ (0, x.jsx)("div", {
								className: "liveRunList",
								id: "liveRunList"
							}),
							/* @__PURE__ */ (0, x.jsx)("pre", {
								className: "fullLogView",
								id: "fullLogView",
								hidden: !0
							})
						]
					}),
					/* @__PURE__ */ (0, x.jsx)("section", {
						className: "workflowMetricCards",
						id: "workflowMetricCards",
						hidden: !0,
						children: Ie.map((e) => /* @__PURE__ */ (0, x.jsx)(Re, { m: e }, e.id))
					}),
					/* @__PURE__ */ (0, x.jsxs)("section", {
						className: "openRouterMetrics",
						id: "openRouterMetrics",
						hidden: !0,
						"aria-hidden": "true",
						children: [
							/* @__PURE__ */ (0, x.jsx)("span", {
								id: "openRouterCalls",
								children: "0"
							}),
							/* @__PURE__ */ (0, x.jsx)("span", {
								id: "openRouterInputTokens",
								children: "0"
							}),
							/* @__PURE__ */ (0, x.jsx)("span", {
								id: "openRouterOutputTokens",
								children: "0"
							}),
							/* @__PURE__ */ (0, x.jsx)("span", {
								id: "openRouterCost",
								children: "$0.0000"
							}),
							/* @__PURE__ */ (0, x.jsx)("span", {
								id: "openRouterSpeed",
								children: "—"
							})
						]
					}),
					/* @__PURE__ */ (0, x.jsx)("div", {
						className: "workflowHint",
						id: "workflowHint",
						children: "שלח הודעה בצ׳אט כדי לראות את רכיבי המערכת, הקווים ביניהם והלוגים של ההרצה האחרונה."
					}),
					/* @__PURE__ */ (0, x.jsxs)("div", {
						className: "workflowToolbar",
						id: "workflowToolbar",
						hidden: !0,
						children: [
							/* @__PURE__ */ (0, x.jsxs)("div", {
								className: "workflowSearchGroup",
								children: [/* @__PURE__ */ (0, x.jsx)("input", {
									id: "workflowSearch",
									type: "search",
									placeholder: "Search node, input, output",
									autoComplete: "off"
								}), /* @__PURE__ */ (0, x.jsxs)("select", {
									id: "workflowStatusFilter",
									"aria-label": "Filter workflow status",
									children: [
										/* @__PURE__ */ (0, x.jsx)("option", {
											value: "",
											children: "All statuses"
										}),
										/* @__PURE__ */ (0, x.jsx)("option", {
											value: "done",
											children: "Done"
										}),
										/* @__PURE__ */ (0, x.jsx)("option", {
											value: "error",
											children: "Error"
										}),
										/* @__PURE__ */ (0, x.jsx)("option", {
											value: "skipped",
											children: "Skipped"
										})
									]
								})]
							}),
							/* @__PURE__ */ (0, x.jsxs)("div", {
								className: "workflowToolGroup",
								children: [
									/* @__PURE__ */ (0, x.jsx)("button", {
										id: "workflowErrorsOnly",
										type: "button",
										title: "Show errors only",
										children: "Errors"
									}),
									/* @__PURE__ */ (0, x.jsx)("button", {
										id: "workflowSlowNodes",
										type: "button",
										title: "Highlight slow nodes",
										children: "Slow"
									}),
									/* @__PURE__ */ (0, x.jsx)("button", {
										id: "workflowExpensiveNodes",
										type: "button",
										title: "Highlight expensive nodes",
										children: "Cost"
									}),
									/* @__PURE__ */ (0, x.jsx)("button", {
										id: "workflowFallbackNodes",
										type: "button",
										title: "Highlight fallback route",
										children: "Fallback"
									}),
									/* @__PURE__ */ (0, x.jsx)("button", {
										id: "workflowRegressionNodes",
										type: "button",
										title: "Highlight regressions",
										children: "Regressions"
									}),
									/* @__PURE__ */ (0, x.jsx)("button", {
										id: "clearWorkflowCompare",
										type: "button",
										title: "Clear run comparison",
										hidden: !0,
										children: "Clear Compare"
									}),
									/* @__PURE__ */ (0, x.jsx)("button", {
										id: "fitWorkflow",
										type: "button",
										title: "Fit to screen",
										children: "Fit"
									}),
									/* @__PURE__ */ (0, x.jsx)("button", {
										id: "toggleWorkflowCards",
										type: "button",
										title: "Expand or collapse node cards",
										children: "Collapse"
									}),
									/* @__PURE__ */ (0, x.jsx)("button", {
										id: "resetWorkflowFilters",
										type: "button",
										title: "Reset workflow filters",
										children: "Reset"
									})
								]
							}),
							/* @__PURE__ */ (0, x.jsx)("div", {
								className: "workflowIssueSummary",
								id: "workflowIssueSummary",
								children: "0 matches"
							})
						]
					}),
					/* @__PURE__ */ (0, x.jsx)("div", {
						className: "workflowCompareSummary",
						id: "workflowCompareSummary",
						hidden: !0
					}),
					/* @__PURE__ */ (0, x.jsx)("div", {
						className: "workflowBoard",
						id: "workflowBoard",
						children: /* @__PURE__ */ (0, x.jsx)("div", { id: "workflowCy" })
					}),
					/* @__PURE__ */ (0, x.jsxs)("div", {
						className: "workflowBottomPanel",
						id: "workflowBottomPanel",
						hidden: !0,
						children: [/* @__PURE__ */ (0, x.jsxs)("div", {
							className: "workflowBottomTabBar",
							children: [/* @__PURE__ */ (0, x.jsx)("div", {
								className: "workflowBottomTabs",
								children: Le.map((e, t) => /* @__PURE__ */ (0, x.jsx)("button", {
									className: `bottomTab${t === 0 ? " active" : ""}`,
									"data-bottom-tab": e.id,
									children: e.label
								}, e.id))
							}), /* @__PURE__ */ (0, x.jsxs)("button", {
								id: "wfExportBtn",
								className: "wfExportBtn",
								type: "button",
								children: [/* @__PURE__ */ (0, x.jsx)(Pe, {
									path: [
										"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",
										"M7 10l5 5 5-5",
										"M12 15V3"
									],
									size: 14,
									strokeWidth: 2.2
								}), "יצוא ריצה"]
							})]
						}), /* @__PURE__ */ (0, x.jsxs)("div", {
							className: "workflowBottomTabContent",
							children: [
								/* @__PURE__ */ (0, x.jsx)("div", {
									className: "bottomTabPane active",
									id: "wfPane_overview",
									children: /* @__PURE__ */ (0, x.jsxs)("table", {
										className: "wfOverviewTable",
										children: [/* @__PURE__ */ (0, x.jsx)("thead", { children: /* @__PURE__ */ (0, x.jsxs)("tr", { children: [
											/* @__PURE__ */ (0, x.jsx)("th", { children: "Run ID" }),
											/* @__PURE__ */ (0, x.jsx)("th", { children: "Started At" }),
											/* @__PURE__ */ (0, x.jsx)("th", { children: "Duration" }),
											/* @__PURE__ */ (0, x.jsx)("th", { children: "Status" }),
											/* @__PURE__ */ (0, x.jsx)("th", { children: "Model" }),
											/* @__PURE__ */ (0, x.jsx)("th", { children: "Environment" }),
											/* @__PURE__ */ (0, x.jsx)("th", { children: "Workflow Version" })
										] }) }), /* @__PURE__ */ (0, x.jsx)("tbody", { children: /* @__PURE__ */ (0, x.jsxs)("tr", { children: [
											/* @__PURE__ */ (0, x.jsx)("td", {
												id: "wfOverview_runId",
												children: "—"
											}),
											/* @__PURE__ */ (0, x.jsx)("td", {
												id: "wfOverview_startedAt",
												children: "—"
											}),
											/* @__PURE__ */ (0, x.jsx)("td", {
												id: "wfOverview_duration",
												children: "—"
											}),
											/* @__PURE__ */ (0, x.jsx)("td", {
												id: "wfOverview_status",
												children: "—"
											}),
											/* @__PURE__ */ (0, x.jsx)("td", {
												id: "wfOverview_model",
												children: "—"
											}),
											/* @__PURE__ */ (0, x.jsx)("td", {
												id: "wfOverview_environment",
												children: "—"
											}),
											/* @__PURE__ */ (0, x.jsx)("td", {
												id: "wfOverview_version",
												children: "—"
											})
										] }) })]
									})
								}),
								/* @__PURE__ */ (0, x.jsx)("div", {
									className: "bottomTabPane",
									id: "wfPane_filters",
									hidden: !0,
									children: /* @__PURE__ */ (0, x.jsx)("div", {
										className: "panePlaceholder",
										children: "תוכן פילטרים זמין דרך סרגל הכלים העליון."
									})
								}),
								/* @__PURE__ */ (0, x.jsx)("div", {
									className: "bottomTabPane",
									id: "wfPane_events",
									hidden: !0,
									children: /* @__PURE__ */ (0, x.jsx)("div", {
										className: "panePlaceholder",
										children: "בחר רכיב בגרף כדי לראות אירועים רלוונטיים."
									})
								}),
								/* @__PURE__ */ (0, x.jsx)("div", {
									className: "bottomTabPane",
									id: "wfPane_logs",
									hidden: !0,
									children: /* @__PURE__ */ (0, x.jsx)("div", {
										className: "panePlaceholder",
										children: "לוג ריצה מלא זמין דרך כפתור \"לוג מלא\" למעלה."
									})
								}),
								/* @__PURE__ */ (0, x.jsx)("div", {
									className: "bottomTabPane",
									id: "wfPane_metrics",
									hidden: !0,
									children: /* @__PURE__ */ (0, x.jsx)("div", {
										className: "panePlaceholder",
										children: "מדדי ביצוע מפורטים זמינים בפאנל הפירוט של הרכיבים."
									})
								})
							]
						})]
					}),
					/* @__PURE__ */ (0, x.jsx)("aside", {
						className: "workflowInspector",
						id: "workflowInspector",
						children: /* @__PURE__ */ (0, x.jsx)("div", {
							className: "workflowInspectorEmpty",
							children: "בחר רכיב בגרף כדי לראות Input / Output."
						})
					}),
					/* @__PURE__ */ (0, x.jsxs)("section", {
						className: "workflowAiReport",
						id: "workflowAiReport",
						hidden: !0,
						children: [/* @__PURE__ */ (0, x.jsxs)("header", { children: [/* @__PURE__ */ (0, x.jsx)("strong", { children: "דוח AI" }), /* @__PURE__ */ (0, x.jsx)("span", {
							id: "workflowAiReportStatus",
							children: "ממתין להרצה"
						})] }), /* @__PURE__ */ (0, x.jsx)("div", { id: "workflowAiReportBody" })]
					})
				]
			})]
		})]
	});
}
//#endregion
//#region src/react/InsightsPage.jsx
var Be = "2024-02-01", Ve = "2026-01-01", He = 350, V = ({ path: e, size: t = 16, strokeWidth: n = 2, ...r }) => /* @__PURE__ */ (0, x.jsx)("svg", {
	width: t,
	height: t,
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: n,
	strokeLinecap: "round",
	strokeLinejoin: "round",
	...r,
	children: Array.isArray(e) ? e.map((e, t) => /* @__PURE__ */ (0, x.jsx)("path", { d: e }, t)) : /* @__PURE__ */ (0, x.jsx)("path", { d: e })
}), Ue = {
	spark: ["M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6L12 3z", "M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16z"],
	refresh: [
		"M23 4v6h-6",
		"M1 20v-6h6",
		"M3.5 9a9 9 0 0 1 14.8-3.5L23 10",
		"M1 14l4.7 4.5A9 9 0 0 0 20.5 15"
	],
	play: "M5 3l14 9-14 9V3z",
	plus: "M12 5v14M5 12h14",
	history: [
		"M12 8v5l3 2",
		"M3 12a9 9 0 1 0 3-6.7",
		"M3 3v6h6"
	],
	chart: [
		"M3 3v18h18",
		"M8 17V9",
		"M13 17V6",
		"M18 17v-4"
	],
	check: "M20 6L9 17l-5-5",
	alert: "M10.3 3.3L1.5 18A2 2 0 0 0 3.2 21h17.6a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01",
	workflow: [
		"M18 18a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
		"M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
		"M13 6h3a2 2 0 0 1 2 2v4",
		"M6 9v7a2 2 0 0 0 2 2h7"
	],
	chevron: "M9 18l6-6-6-6"
};
async function We(e, t = {}) {
	let { timeoutMs: n = 3e4, ...r } = t, i = new AbortController(), a = setTimeout(() => i.abort(), n);
	try {
		let t = await fetch(e, {
			headers: {
				"Content-Type": "application/json",
				...r.headers || {}
			},
			...r,
			body: r.body && typeof r.body != "string" ? JSON.stringify(r.body) : r.body,
			signal: i.signal
		}), n = await t.text(), a = n ? JSON.parse(n) : {};
		if (!t.ok) throw Error(a?.error || a?.message || `HTTP ${t.status}`);
		return a;
	} finally {
		clearTimeout(a);
	}
}
function Ge(e) {
	return [...new Set((e || []).filter(Boolean))];
}
function Ke(e = {}, t = !1) {
	let n = Array.isArray(e.findings) ? e.findings : Array.isArray(e.metadata?.findings) ? e.metadata.findings : [];
	return n.length ? n : t ? (Array.isArray(e.insights) ? e.insights : []).map((e, t) => ({
		id: e.id || `legacy_${t + 1}`,
		title: e.title || "ממצא",
		category: e.category,
		severity: e.severity,
		confidence: e.confidence,
		finding: e.finding || e.insight || e.summary || "",
		why_it_matters: e.why_it_matters,
		recommended_action: e.recommended_action,
		evidence: e.evidence || e.sources || []
	})) : [];
}
function qe(e = {}) {
	let t = Array.isArray(e.insights) ? e.insights : [];
	return t.length ? Array.isArray(e.findings) || Array.isArray(e.metadata?.findings) ? t : t.filter((e) => Array.isArray(e?.supporting_finding_ids) && e.supporting_finding_ids.length) : [];
}
function Je(e, t) {
	if (!e || e.ok === !1) return t;
	let n = Ke(e, !0), r = Ke(t), i = qe(e), a = qe(t);
	return {
		...t,
		summary: {
			...t.summary || {},
			totalRecords: Number(e.summary?.totalRecords || 0) + Number(t.summary?.totalRecords || 0),
			expandedRuns: Number(e.summary?.expandedRuns || 1) + 1
		},
		findings: Ye([...n, ...r]),
		insights: Ye([...i, ...a]),
		workflowLog: t.workflowLog || e.workflowLog
	};
}
function Ye(e = []) {
	let t = /* @__PURE__ */ new Set(), n = [];
	for (let r of e) {
		let e = String(r.id || r.title || r.finding || r.insight || JSON.stringify(r)).slice(0, 180);
		t.has(e) || (t.add(e), n.push(r));
	}
	return n;
}
function Xe(e = {}) {
	let t = e.metadata || {}, n = {
		...e,
		metadata: t
	};
	return {
		ok: e.status !== "error",
		error: e.error || "",
		runId: e.run_id || e.runId || "",
		summary: {
			...t.summary || {},
			focusQuery: e.focus_query || t.summary?.focusQuery || "",
			dateFrom: e.date_from || t.summary?.dateFrom || "",
			dateTo: e.date_to || t.summary?.dateTo || "",
			totalRecords: e.scanned_count || t.summary?.totalRecords || 0
		},
		insights: qe(n),
		findings: Ke(n, !0),
		workflowLog: e.workflow_log || t.workflowLog || null,
		scannedSourceKeys: e.scanned_source_keys || t.scannedSourceKeys || [],
		healthScore: t.healthScore || e.healthScore,
		trends: t.trends || e.trends,
		rootCauseHypotheses: t.rootCauseHypotheses || e.rootCauseHypotheses
	};
}
function Ze(e) {
	return {
		blocker: "חסם",
		decision: "החלטה",
		missing_info: "מידע חסר",
		repeated_topic: "נושא חוזר",
		commercial: "מסחרי",
		quality_safety: "איכות/בטיחות",
		entity: "ישות"
	}[e] || e || "כללי";
}
function Qe(e) {
	return {
		high: "גבוה",
		medium: "בינוני",
		low: "נמוך"
	}[e] || e || "בינוני";
}
function $e(e) {
	if (!e) return "";
	let t = Date.now() - new Date(e).getTime();
	if (!Number.isFinite(t)) return "";
	let n = Math.max(1, Math.round(t / 6e4));
	if (n < 60) return `לפני ${n} דק׳`;
	let r = Math.round(n / 60);
	return r < 24 ? `לפני ${r} שעות` : `לפני ${Math.round(r / 24)} ימים`;
}
function et(e = {}) {
	let t = e.evidence || e.sources || e.records || e.evidence_records || [];
	return Array.isArray(t) ? t.slice(0, 5) : [];
}
function tt() {
	let [e, t] = (0, b.useState)(""), [n, r] = (0, b.useState)(Be), [i, a] = (0, b.useState)(Ve), [o, s] = (0, b.useState)(He), [c, l] = (0, b.useState)({
		crossWindowTrend: !1,
		rootCauseHypotheses: !1,
		healthScore: !1,
		graphClustering: !1
	}), [u, d] = (0, b.useState)("alerts"), [f, p] = (0, b.useState)(!1), [m, h] = (0, b.useState)([]), [g, _] = (0, b.useState)([]), [v, y] = (0, b.useState)([]), [S, C] = (0, b.useState)(!1), [w, T] = (0, b.useState)(""), [E, D] = (0, b.useState)(null), [O, k] = (0, b.useState)(!1), [A, j] = (0, b.useState)({
		state: "idle",
		text: "מוכן להרצת סוכן התובנות"
	}), [M, N] = (0, b.useState)([]), [ee, P] = (0, b.useState)([]), [F, I] = (0, b.useState)(0), te = (0, b.useRef)(null), L = (0, b.useRef)(null), ne = (0, b.useMemo)(() => {
		let e = m.slice(0, 30);
		return f ? [...e].sort((e, t) => String(e.tag).localeCompare(String(t.tag), "he")) : e;
	}, [m, f]), re = (0, b.useMemo)(() => Math.max(...ne.map((e) => Number(e.count || 0)), 1), [ne]), ie = (0, b.useMemo)(() => qe(E || {}), [E]), R = (0, b.useMemo)(() => Ke(E || {}, !0), [E]), ae = !!(E && E.ok !== !1 && (ee.length || E.scannedSourceKeys?.length)), oe = (0, b.useCallback)(async (e = {}) => {
		let t = e.source || u, r = new URLSearchParams();
		n && r.set("date_from", n), i && r.set("date_to", i), r.set("source", t);
		let a = await We(`/api/insights/hashtags?${r}`, { timeoutMs: 15e3 });
		h(Array.isArray(a.hashtags) ? a.hashtags : []), d(t);
	}, [
		u,
		n,
		i
	]), se = (0, b.useCallback)(async () => {
		let e = await We("/api/insights/runs?limit=30", { timeoutMs: 2e4 });
		y(Array.isArray(e.runs) ? e.runs : []);
	}, []);
	(0, b.useEffect)(() => {
		oe().catch((e) => j({
			state: "error",
			text: `לא ניתן לטעון האשטגים: ${e.message}`
		}));
	}, [oe]), (0, b.useEffect)(() => {
		se().catch(() => {});
	}, [se]), (0, b.useEffect)(() => () => {
		te.current && te.current.close();
	}, []);
	function ce(e) {
		l((t) => ({
			...t,
			[e]: !t[e]
		}));
	}
	function le(e) {
		_((t) => t.includes(e) ? t.filter((t) => t !== e) : [...t, e]);
	}
	function ue(e) {
		te.current && te.current.close(), N([]);
		try {
			let t = new EventSource(`/api/runs/${encodeURIComponent(e)}/events`);
			t.addEventListener("log", (e) => {
				try {
					let t = JSON.parse(e.data);
					if (t.step === "complete" || t.step === "error") return;
					let n = mt(t);
					N((e) => e[e.length - 1] === n ? e : [...e, n]);
				} catch {}
			}), t.onerror = () => {}, te.current = t;
		} catch {
			te.current = null;
		}
	}
	async function de({ expansion: t = !1 } = {}) {
		if (O) return;
		k(!0);
		let r = t ? ee : [], a = `project_insights_${Date.now()}_${Math.random().toString(16).slice(2)}`;
		j({
			state: "running",
			text: t ? `מרחיב תשובה ומדלג על ${r.length.toLocaleString()} מקורות שכבר נותחו...` : "מריץ ניתוח על נתוני האינדקס..."
		}), t || (D(null), P([]), I(0), T("")), ue(a);
		try {
			let s = await We("/api/insights/analyze", {
				method: "POST",
				timeoutMs: 9e5,
				body: {
					runId: a,
					focusQuery: e,
					dateFrom: n || null,
					dateTo: i || null,
					limit: Number(o || He),
					selectedHashtags: g,
					hashtagMode: "boost",
					insights: Object.fromEntries(Object.entries(c).filter(([, e]) => e)),
					excludeSourceKeys: r,
					expansion: t,
					parentRunId: t && (E?.runId || w) || null
				}
			}), l = t ? Je(E, s) : s;
			D(l), P((e) => Ge([...e, ...s.scannedSourceKeys || []])), I((e) => e + 1), T(l?.runId || s.runId || ""), j({
				state: "done",
				text: "ניתוח התובנות הסתיים"
			}), window.__bidocSetWorkflowFromReact?.(s), await se().catch(() => {}), setTimeout(() => L.current?.scrollIntoView({
				behavior: "smooth",
				block: "start"
			}), 120);
		} catch (e) {
			D(t && E ? {
				...E,
				expansionError: e.message
			} : {
				ok: !1,
				error: e.message
			}), j({
				state: "error",
				text: `ניתוח התובנות נכשל: ${e.message}`
			});
		} finally {
			te.current && te.current.close(), te.current = null, k(!1);
		}
	}
	function fe(e) {
		let n = Xe(e);
		D(n), T(n.runId), P(Array.isArray(e.scanned_source_keys) ? e.scanned_source_keys : n.scannedSourceKeys || []), I(Number(n.summary?.expandedRuns || e.metadata?.runCount || (e.is_expansion ? 2 : 1) || 1)), t(e.focus_query || n.summary?.focusQuery || ""), (e.date_from || n.summary?.dateFrom) && r(e.date_from || n.summary.dateFrom), (e.date_to || n.summary?.dateTo) && a(e.date_to || n.summary.dateTo), e.source_limit && s(Number(e.source_limit)), j({
			state: "done",
			text: "דוח תובנות נטען מההיסטוריה"
		}), window.__bidocSetWorkflowFromReact?.(n);
	}
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		className: "reactInsights",
		dir: "rtl",
		children: [
			/* @__PURE__ */ (0, x.jsxs)("header", {
				className: "riHero",
				children: [/* @__PURE__ */ (0, x.jsxs)("div", {
					className: "riHeroMain",
					children: [
						/* @__PURE__ */ (0, x.jsxs)("span", {
							className: "riEyebrow",
							children: [/* @__PURE__ */ (0, x.jsx)(V, {
								path: Ue.spark,
								size: 14
							}), " Project Intelligence"]
						}),
						/* @__PURE__ */ (0, x.jsx)("h2", { children: "סוכן תובנות" }),
						/* @__PURE__ */ (0, x.jsx)("p", { children: "מסך עבודה לריצות עומק על אינדקס הפרויקט: איתור חסמים, החלטות פתוחות, ישויות משפיעות, מגמות וסיכונים עם ראיות." })
					]
				}), /* @__PURE__ */ (0, x.jsxs)("div", {
					className: "riHeroStats",
					children: [
						/* @__PURE__ */ (0, x.jsx)(nt, {
							label: "ריצות שמורות",
							value: v.length || "0"
						}),
						/* @__PURE__ */ (0, x.jsx)(nt, {
							label: "האשטגים פעילים",
							value: g.length || "0"
						}),
						/* @__PURE__ */ (0, x.jsx)(nt, {
							label: "מקורות בסריקה",
							value: Number(o || 0).toLocaleString()
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, x.jsxs)("section", {
				className: "riCommand",
				children: [
					/* @__PURE__ */ (0, x.jsxs)("div", {
						className: "riCommandGrid",
						children: [
							/* @__PURE__ */ (0, x.jsxs)("label", {
								className: "riField riFieldWide",
								children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "מיקוד אופציונלי" }), /* @__PURE__ */ (0, x.jsx)("input", {
									value: e,
									onChange: (e) => t(e.target.value),
									onKeyDown: (e) => {
										e.key === "Enter" && (e.ctrlKey || e.metaKey) && (e.preventDefault(), de({ expansion: e.shiftKey }));
									},
									placeholder: "לדוגמה: חסמים בפרויקט, אישורים פתוחים, עלויות חריגות"
								})]
							}),
							/* @__PURE__ */ (0, x.jsxs)("label", {
								className: "riField",
								children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "מתאריך" }), /* @__PURE__ */ (0, x.jsx)("input", {
									type: "date",
									value: n,
									onChange: (e) => r(e.target.value)
								})]
							}),
							/* @__PURE__ */ (0, x.jsxs)("label", {
								className: "riField",
								children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "עד תאריך" }), /* @__PURE__ */ (0, x.jsx)("input", {
									type: "date",
									value: i,
									onChange: (e) => a(e.target.value)
								})]
							}),
							/* @__PURE__ */ (0, x.jsxs)("label", {
								className: "riField",
								children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "כמות מקורות" }), /* @__PURE__ */ (0, x.jsxs)("select", {
									value: o,
									onChange: (e) => s(Number(e.target.value)),
									children: [
										/* @__PURE__ */ (0, x.jsx)("option", {
											value: "200",
											children: "200"
										}),
										/* @__PURE__ */ (0, x.jsx)("option", {
											value: "350",
											children: "350"
										}),
										/* @__PURE__ */ (0, x.jsx)("option", {
											value: "700",
											children: "700"
										})
									]
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, x.jsxs)("div", {
						className: "riEngineRow",
						children: [
							/* @__PURE__ */ (0, x.jsx)("span", { children: "מנועי עומק" }),
							/* @__PURE__ */ (0, x.jsx)(rt, {
								checked: c.crossWindowTrend,
								onClick: () => ce("crossWindowTrend"),
								label: "מגמות"
							}),
							/* @__PURE__ */ (0, x.jsx)(rt, {
								checked: c.rootCauseHypotheses,
								onClick: () => ce("rootCauseHypotheses"),
								label: "סיבת שורש"
							}),
							/* @__PURE__ */ (0, x.jsx)(rt, {
								checked: c.healthScore,
								onClick: () => ce("healthScore"),
								label: "ציון בריאות"
							}),
							/* @__PURE__ */ (0, x.jsx)(rt, {
								checked: c.graphClustering,
								onClick: () => ce("graphClustering"),
								label: "גרף"
							})
						]
					}),
					/* @__PURE__ */ (0, x.jsxs)("div", {
						className: "riActionRow",
						children: [
							/* @__PURE__ */ (0, x.jsxs)("button", {
								className: "riBtn riBtnPrimary",
								disabled: O,
								onClick: () => de(),
								children: [
									/* @__PURE__ */ (0, x.jsx)(V, {
										path: Ue.play,
										size: 15
									}),
									" ",
									O ? "מנתח..." : "נתח את הפרויקט"
								]
							}),
							/* @__PURE__ */ (0, x.jsxs)("button", {
								className: "riBtn",
								disabled: O || !ae,
								onClick: () => de({ expansion: !0 }),
								children: [/* @__PURE__ */ (0, x.jsx)(V, {
									path: Ue.plus,
									size: 15
								}), " הרחב תשובה"]
							}),
							/* @__PURE__ */ (0, x.jsxs)("button", {
								className: "riBtn",
								onClick: () => oe().catch((e) => j({
									state: "error",
									text: e.message
								})),
								children: [/* @__PURE__ */ (0, x.jsx)(V, {
									path: Ue.refresh,
									size: 15
								}), " רענן האשטגים"]
							}),
							/* @__PURE__ */ (0, x.jsx)("span", {
								className: "riShortcut",
								children: "Ctrl+Enter להרצה · Ctrl+Shift+Enter להרחבה"
							})
						]
					})
				]
			}),
			/* @__PURE__ */ (0, x.jsxs)("section", {
				className: "riSplit",
				children: [/* @__PURE__ */ (0, x.jsx)(it, {
					hashtags: ne,
					max: re,
					selected: g,
					source: u,
					sortAlpha: f,
					onToggleTag: le,
					onSource: (e) => oe({ source: e }).catch((e) => j({
						state: "error",
						text: e.message
					})),
					onSort: p,
					onClear: () => _([])
				}), /* @__PURE__ */ (0, x.jsx)(at, {
					history: v,
					open: S,
					selectedRunId: w,
					onToggle: () => C((e) => !e),
					onRefresh: () => se().catch((e) => j({
						state: "error",
						text: e.message
					})),
					onSelect: fe
				})]
			}),
			/* @__PURE__ */ (0, x.jsx)(H, {
				status: A,
				liveSteps: M,
				result: E,
				runCount: F,
				scannedKeys: ee,
				insights: ie,
				findings: R
			}),
			/* @__PURE__ */ (0, x.jsx)("section", {
				className: "riResults",
				ref: L,
				children: O && !E ? /* @__PURE__ */ (0, x.jsx)(pt, {}) : /* @__PURE__ */ (0, x.jsx)(U, {
					result: E,
					insights: ie,
					findings: R
				})
			})
		]
	});
}
function nt({ label: e, value: t }) {
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		className: "riMetric",
		children: [/* @__PURE__ */ (0, x.jsx)("span", { children: e }), /* @__PURE__ */ (0, x.jsx)("strong", { children: t })]
	});
}
function rt({ checked: e, onClick: t, label: n }) {
	return /* @__PURE__ */ (0, x.jsxs)("button", {
		type: "button",
		className: "riToggle",
		"aria-pressed": e,
		onClick: t,
		children: [/* @__PURE__ */ (0, x.jsx)("span", { "aria-hidden": "true" }), n]
	});
}
function it({ hashtags: e, max: t, selected: n, source: r, sortAlpha: i, onToggleTag: a, onSource: o, onSort: s, onClear: c }) {
	return /* @__PURE__ */ (0, x.jsxs)("section", {
		className: "riPanel riHashtags",
		children: [
			/* @__PURE__ */ (0, x.jsxs)("header", { children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsxs)("span", {
				className: "riEyebrow",
				children: [/* @__PURE__ */ (0, x.jsx)(V, {
					path: Ue.chart,
					size: 13
				}), " Hashtag Analytics"]
			}), /* @__PURE__ */ (0, x.jsx)("h3", { children: "אותות חוזרים באינדקס" })] }), /* @__PURE__ */ (0, x.jsxs)("div", {
				className: "riSegment",
				children: [/* @__PURE__ */ (0, x.jsx)("button", {
					"aria-pressed": r === "alerts",
					onClick: () => o("alerts"),
					children: "Alerts"
				}), /* @__PURE__ */ (0, x.jsx)("button", {
					"aria-pressed": r === "index",
					onClick: () => o("index"),
					children: "אינדקס"
				})]
			})] }),
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "riChartControls",
				children: [
					/* @__PURE__ */ (0, x.jsx)("button", {
						className: "riMiniBtn",
						"aria-pressed": i,
						onClick: () => s(!0),
						children: "א-ב"
					}),
					/* @__PURE__ */ (0, x.jsx)("button", {
						className: "riMiniBtn",
						"aria-pressed": !i,
						onClick: () => s(!1),
						children: "כמות"
					}),
					n.length ? /* @__PURE__ */ (0, x.jsx)("button", {
						className: "riMiniBtn",
						onClick: c,
						children: "נקה בחירה"
					}) : /* @__PURE__ */ (0, x.jsx)("span", { children: "לחץ על תגית כדי לחזק אותה בניתוח הבא" })
				]
			}),
			/* @__PURE__ */ (0, x.jsx)("div", {
				className: "riSelectedTags",
				children: n.length ? n.map((e) => /* @__PURE__ */ (0, x.jsxs)("button", {
					onClick: () => a(e),
					children: [
						"#",
						e,
						" ×"
					]
				}, e)) : /* @__PURE__ */ (0, x.jsx)("span", { children: "אין תגיות נבחרות" })
			}),
			/* @__PURE__ */ (0, x.jsx)("div", {
				className: "riBars",
				children: e.length ? e.map((e) => /* @__PURE__ */ (0, x.jsxs)("button", {
					className: "riBar",
					"data-selected": n.includes(e.tag) ? "true" : "false",
					onClick: () => a(e.tag),
					children: [
						/* @__PURE__ */ (0, x.jsxs)("span", { children: ["#", e.tag] }),
						/* @__PURE__ */ (0, x.jsx)("i", { style: { "--bar": `${Math.max(5, Number(e.count || 0) / t * 100)}%` } }),
						/* @__PURE__ */ (0, x.jsx)("b", { children: Number(e.count || 0).toLocaleString() })
					]
				}, e.tag)) : /* @__PURE__ */ (0, x.jsx)("div", {
					className: "riEmpty",
					children: "אין נתוני האשטגים לטווח הנבחר."
				})
			})
		]
	});
}
function at({ history: e, open: t, selectedRunId: n, onToggle: r, onRefresh: i, onSelect: a }) {
	return /* @__PURE__ */ (0, x.jsxs)("section", {
		className: "riPanel riHistory",
		"data-open": t ? "true" : "false",
		children: [/* @__PURE__ */ (0, x.jsxs)("header", { children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsxs)("span", {
			className: "riEyebrow",
			children: [/* @__PURE__ */ (0, x.jsx)(V, {
				path: Ue.history,
				size: 13
			}), " Run History"]
		}), /* @__PURE__ */ (0, x.jsx)("h3", { children: "היסטוריית תובנות" })] }), /* @__PURE__ */ (0, x.jsxs)("div", {
			className: "riHistoryActions",
			children: [/* @__PURE__ */ (0, x.jsx)("button", {
				className: "riMiniBtn",
				onClick: r,
				"aria-expanded": t,
				children: t ? "הסתר" : `הצג (${e.length})`
			}), /* @__PURE__ */ (0, x.jsx)("button", {
				className: "riMiniBtn",
				onClick: i,
				children: "רענן"
			})]
		})] }), t && /* @__PURE__ */ (0, x.jsx)("div", {
			className: "riHistoryList",
			children: e.length ? e.map((e) => {
				let t = Xe(e);
				return /* @__PURE__ */ (0, x.jsxs)("button", {
					className: "riHistoryItem",
					"aria-pressed": n && n === t.runId,
					onClick: () => a(e),
					children: [
						/* @__PURE__ */ (0, x.jsx)("strong", { children: e.focus_query || t.summary?.focusQuery || "סריקה כללית" }),
						/* @__PURE__ */ (0, x.jsxs)("span", { children: [
							t.insights.length,
							" תובנות · ",
							t.findings.length,
							" ממצאים · ",
							Number(e.scanned_count || t.summary?.totalRecords || 0).toLocaleString(),
							" מקורות"
						] }),
						/* @__PURE__ */ (0, x.jsxs)("small", { children: [
							e.status === "error" ? "שגיאה" : e.is_expansion ? "הרחבה" : "ריצה",
							" · ",
							$e(e.created_at)
						] })
					]
				}, t.runId || e.created_at);
			}) : /* @__PURE__ */ (0, x.jsx)("div", {
				className: "riEmpty",
				children: "אין עדיין ריצות שמורות."
			})
		})]
	});
}
function H({ status: e, liveSteps: t, result: n, runCount: r, scannedKeys: i, insights: a, findings: o }) {
	let s = n?.summary || {}, c = i.length || n?.scannedSourceKeys?.length || Number(s.totalRecords || 0);
	return /* @__PURE__ */ (0, x.jsxs)("section", {
		className: "riStatus",
		"data-state": e.state,
		children: [
			/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("strong", { children: e.text }), n && n.ok !== !1 && /* @__PURE__ */ (0, x.jsxs)("span", { children: [
				Number(s.totalRecords || 0).toLocaleString(),
				" מקורות · ",
				a.length,
				" תובנות · ",
				o.length,
				" ממצאים · ",
				r || s.expandedRuns || 1,
				" ריצות"
			] })] }),
			n?.workflowLog && /* @__PURE__ */ (0, x.jsxs)("button", {
				className: "riMiniBtn",
				onClick: () => window.__bidocActivateTab?.("workflow"),
				children: [/* @__PURE__ */ (0, x.jsx)(V, {
					path: Ue.workflow,
					size: 13
				}), " פתח Workflow"]
			}),
			!n && c > 0 && /* @__PURE__ */ (0, x.jsxs)("span", { children: [c.toLocaleString(), " מקורות נסרקו"] }),
			t.length > 0 && /* @__PURE__ */ (0, x.jsx)("div", {
				className: "riLiveSteps",
				children: t.slice(-7).map((e, n) => /* @__PURE__ */ (0, x.jsxs)("span", {
					className: n === t.slice(-7).length - 1 ? "active" : "done",
					children: [n === t.slice(-7).length - 1 ? /* @__PURE__ */ (0, x.jsx)("i", { className: "progressSpinner" }) : /* @__PURE__ */ (0, x.jsx)(V, {
						path: Ue.check,
						size: 11
					}), e]
				}, `${e}_${n}`))
			})
		]
	});
}
function U({ result: e, insights: t, findings: n }) {
	if (!e) return /* @__PURE__ */ (0, x.jsxs)("div", {
		className: "riWelcome",
		children: [
			/* @__PURE__ */ (0, x.jsx)("span", { children: /* @__PURE__ */ (0, x.jsx)(V, {
				path: Ue.spark,
				size: 22
			}) }),
			/* @__PURE__ */ (0, x.jsx)("h3", { children: "הרץ ניתוח AI על נתוני הפרויקט" }),
			/* @__PURE__ */ (0, x.jsx)("p", { children: "הסוכן יסרוק את האינדקס, יחבר ממצאים לדפוסים, ויציג תובנות עם פעולה מומלצת וראיות." })
		]
	});
	if (e.ok === !1) return /* @__PURE__ */ (0, x.jsxs)("div", {
		className: "riError",
		children: [
			/* @__PURE__ */ (0, x.jsx)(V, {
				path: Ue.alert,
				size: 18
			}),
			" ",
			e.error || "ניתוח התובנות נכשל."
		]
	});
	let r = /* @__PURE__ */ (0, x.jsx)(ot, { result: e });
	if (!t.length && !n.length && !e.healthScore && !e.trends && !e.rootCauseHypotheses) return /* @__PURE__ */ (0, x.jsx)("div", {
		className: "riEmpty",
		children: "לא נמצאו אותות מספיק חזקים בסריקה הזו. אפשר להרחיב תשובה כדי לסרוק מקורות נוספים."
	});
	let i = new Set(t.flatMap((e) => e.supporting_finding_ids || []).map(String)), a = n.filter((e) => !i.has(String(e.id || "")));
	return /* @__PURE__ */ (0, x.jsxs)(x.Fragment, { children: [
		r,
		/* @__PURE__ */ (0, x.jsxs)("section", {
			className: "riResultSection",
			children: [/* @__PURE__ */ (0, x.jsxs)("header", { children: [/* @__PURE__ */ (0, x.jsx)("h3", { children: "תובנות AI" }), /* @__PURE__ */ (0, x.jsxs)("span", { children: [t.length, " תובנות מסונתזות"] })] }), t.length ? /* @__PURE__ */ (0, x.jsx)("div", {
				className: "riInsightGrid",
				children: t.map((e, t) => /* @__PURE__ */ (0, x.jsx)(ut, {
					insight: e,
					findings: n
				}, e.id || e.title || t))
			}) : /* @__PURE__ */ (0, x.jsx)("div", {
				className: "riEmpty",
				children: "נמצאו ממצאים, אבל אין עדיין חיבור מספיק חזק ביניהם כדי לקרוא לזה תובנה."
			})]
		}),
		a.length > 0 && /* @__PURE__ */ (0, x.jsxs)("section", {
			className: "riResultSection",
			children: [/* @__PURE__ */ (0, x.jsxs)("header", { children: [/* @__PURE__ */ (0, x.jsx)("h3", { children: "ממצאים שלא הפכו לתובנה" }), /* @__PURE__ */ (0, x.jsxs)("span", { children: [a.length, " ממצאים"] })] }), /* @__PURE__ */ (0, x.jsx)("div", {
				className: "riFindingsList",
				children: a.map((e, t) => /* @__PURE__ */ (0, x.jsx)(dt, { finding: e }, e.id || t))
			})]
		})
	] });
}
function ot({ result: e }) {
	let t = [];
	return e.healthScore && t.push(/* @__PURE__ */ (0, x.jsx)(st, { health: e.healthScore }, "health")), Array.isArray(e.trends?.metrics) && e.trends.metrics.length && t.push(/* @__PURE__ */ (0, x.jsx)(ct, { trends: e.trends }, "trends")), Array.isArray(e.rootCauseHypotheses) && e.rootCauseHypotheses.length && t.push(/* @__PURE__ */ (0, x.jsx)(lt, { hypotheses: e.rootCauseHypotheses }, "hypotheses")), t.length ? /* @__PURE__ */ (0, x.jsx)("section", {
		className: "riEnginePanels",
		children: t
	}) : null;
}
function st({ health: e = {} }) {
	let t = e.dimensions || e.subscores || {};
	return /* @__PURE__ */ (0, x.jsxs)("article", {
		className: "riEnginePanel",
		children: [
			/* @__PURE__ */ (0, x.jsxs)("header", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "Executive Health" }), /* @__PURE__ */ (0, x.jsx)("h4", { children: e.score ?? "N/A" })] }),
			/* @__PURE__ */ (0, x.jsx)("div", {
				className: "riHealthRows",
				children: Object.entries(t).map(([e, t]) => {
					let n = typeof t == "object" ? t.score : t;
					return /* @__PURE__ */ (0, x.jsxs)("div", {
						className: "riHealthRow",
						children: [
							/* @__PURE__ */ (0, x.jsx)("span", { children: e }),
							/* @__PURE__ */ (0, x.jsx)("i", { style: { "--bar": `${Number(n || 0)}%` } }),
							/* @__PURE__ */ (0, x.jsx)("b", { children: n ?? "—" })
						]
					}, e);
				})
			}),
			Array.isArray(e.critical_flags) && e.critical_flags.length > 0 && /* @__PURE__ */ (0, x.jsx)("p", { children: e.critical_flags.join(" · ") })
		]
	});
}
function ct({ trends: e = {} }) {
	return /* @__PURE__ */ (0, x.jsxs)("article", {
		className: "riEnginePanel",
		children: [/* @__PURE__ */ (0, x.jsxs)("header", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "Previous Window" }), /* @__PURE__ */ (0, x.jsx)("h4", { children: "מגמות" })] }), /* @__PURE__ */ (0, x.jsx)("div", {
			className: "riTrendRows",
			children: e.metrics.slice(0, 6).map((e) => /* @__PURE__ */ (0, x.jsxs)("div", {
				"data-tone": e.assessment === "worse" ? "bad" : e.assessment === "better" ? "good" : "neutral",
				children: [
					/* @__PURE__ */ (0, x.jsx)("span", { children: e.label || e.metric }),
					/* @__PURE__ */ (0, x.jsxs)("small", { children: [
						e.current ?? "—",
						" ← ",
						e.baseline ?? "—"
					] }),
					/* @__PURE__ */ (0, x.jsx)("b", { children: e.direction || e.assessment || "stable" })
				]
			}, e.metric || e.name))
		})]
	});
}
function lt({ hypotheses: e = [] }) {
	return /* @__PURE__ */ (0, x.jsxs)("article", {
		className: "riEnginePanel",
		children: [/* @__PURE__ */ (0, x.jsxs)("header", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "Requires Validation" }), /* @__PURE__ */ (0, x.jsx)("h4", { children: "השערות סיבת שורש" })] }), /* @__PURE__ */ (0, x.jsx)("div", {
			className: "riHypotheses",
			children: e.slice(0, 4).map((e, t) => /* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("b", { children: e.title || e.hypothesis || "השערה לבדיקה" }), /* @__PURE__ */ (0, x.jsx)("p", { children: e.hypothesis || e.rationale || e.summary })] }, e.id || t))
		})]
	});
}
function ut({ insight: e, findings: t }) {
	let [n, r] = (0, b.useState)(!1), i = (e.supporting_finding_ids || []).map((e) => t.find((t) => String(t.id || "") === String(e))).filter(Boolean);
	return /* @__PURE__ */ (0, x.jsxs)("article", {
		className: "riInsightCard",
		"data-severity": e.severity || "medium",
		children: [
			/* @__PURE__ */ (0, x.jsxs)("header", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: Ze(e.category) }), /* @__PURE__ */ (0, x.jsx)("b", { children: Qe(e.severity) })] }),
			/* @__PURE__ */ (0, x.jsx)("h4", { children: e.title || "תובנה" }),
			/* @__PURE__ */ (0, x.jsx)("p", { children: e.insight || e.finding || e.summary }),
			e.why_it_matters && /* @__PURE__ */ (0, x.jsx)(ft, {
				title: "למה זה חשוב",
				text: e.why_it_matters
			}),
			e.recommended_action && /* @__PURE__ */ (0, x.jsx)(ft, {
				title: "פעולה מומלצת",
				text: e.recommended_action
			}),
			e.uncertainty && /* @__PURE__ */ (0, x.jsx)(ft, {
				title: "אי ודאות",
				text: e.uncertainty
			}),
			i.length > 0 && /* @__PURE__ */ (0, x.jsxs)("div", {
				className: "riSupporting",
				children: [/* @__PURE__ */ (0, x.jsxs)("button", {
					onClick: () => r((e) => !e),
					children: [
						/* @__PURE__ */ (0, x.jsx)(V, {
							path: Ue.chevron,
							size: 13
						}),
						" ",
						n ? "הסתר ממצאים" : `${i.length} ממצאים תומכים`
					]
				}), n && i.map((e, t) => /* @__PURE__ */ (0, x.jsx)(dt, {
					finding: e,
					compact: !0
				}, e.id || t))]
			})
		]
	});
}
function dt({ finding: e, compact: t = !1 }) {
	let n = et(e);
	return /* @__PURE__ */ (0, x.jsxs)("article", {
		className: "riFindingCard",
		"data-compact": t ? "true" : "false",
		"data-severity": e.severity || "medium",
		children: [
			/* @__PURE__ */ (0, x.jsxs)("header", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: Ze(e.category) }), /* @__PURE__ */ (0, x.jsx)("b", { children: Qe(e.severity) })] }),
			/* @__PURE__ */ (0, x.jsx)("h4", { children: e.title || "ממצא" }),
			/* @__PURE__ */ (0, x.jsx)("p", { children: e.finding || e.insight || e.summary }),
			!t && e.recommended_action && /* @__PURE__ */ (0, x.jsx)(ft, {
				title: "פעולה מומלצת",
				text: e.recommended_action
			}),
			n.length > 0 && /* @__PURE__ */ (0, x.jsxs)("details", {
				className: "riEvidence",
				children: [/* @__PURE__ */ (0, x.jsxs)("summary", { children: [n.length, " ראיות"] }), n.map((e, t) => /* @__PURE__ */ (0, x.jsx)("p", { children: typeof e == "string" ? e : e.summary || e.text || e.title || JSON.stringify(e) }, t))]
			})
		]
	});
}
function ft({ title: e, text: t }) {
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		className: "riInfoLine",
		children: [/* @__PURE__ */ (0, x.jsx)("b", { children: e }), /* @__PURE__ */ (0, x.jsx)("span", { children: t })]
	});
}
function pt() {
	return /* @__PURE__ */ (0, x.jsxs)("section", {
		className: "riResultSection",
		children: [/* @__PURE__ */ (0, x.jsxs)("header", { children: [/* @__PURE__ */ (0, x.jsx)("h3", { children: "תובנות AI" }), /* @__PURE__ */ (0, x.jsx)("span", { children: "מנתח..." })] }), /* @__PURE__ */ (0, x.jsxs)("div", {
			className: "riInsightGrid",
			children: [
				/* @__PURE__ */ (0, x.jsx)("div", { className: "insightSkeleton" }),
				/* @__PURE__ */ (0, x.jsx)("div", { className: "insightSkeleton" }),
				/* @__PURE__ */ (0, x.jsx)("div", { className: "insightSkeleton" })
			]
		})]
	});
}
function mt(e = {}) {
	return {
		index_scan: "סורק אינדקס",
		alert_direction: "מנתח התראות",
		hashtag_analysis: "מנתח האשטגים",
		focus_retrieval: "מרחיב אחזור",
		graph_enrichment: "מעשיר גרף",
		graph_search: "מחפש קשרים",
		evidence_pipeline: "מזקק ראיות",
		closure_followup: "בודק סגירות",
		ai_synthesis: "מסנתז תובנות",
		insight_critic: "מבקר תובנות",
		insight_ranking: "מדרג תובנות",
		health_score: "מחשב בריאות"
	}[e.step] || e.label || e.message || e.step || "מעבד";
}
//#endregion
//#region src/react/scheduleTimeline.js
var ht = 1440 * 60 * 1e3, gt = Object.freeze({
	view: "axes",
	onlyLate: !1,
	showLateLines: !1,
	showAsOfMarker: !1,
	alertsOpen: !1,
	conditionsOpen: !1
});
function _t(e) {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(String(e ?? ""))) return null;
	let t = Date.parse(`${e}T00:00:00Z`);
	return Number.isNaN(t) ? null : t;
}
function vt(e) {
	let t = String(e ?? "").trim().match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/u);
	if (!t) return null;
	let n = Number(t[1]), r = Number(t[2]), i = Number(t[3]), a = new Date(Date.UTC(i, r - 1, n));
	return a.getUTCFullYear() !== i || a.getUTCMonth() !== r - 1 || a.getUTCDate() !== n ? null : `${String(i).padStart(4, "0")}-${String(r).padStart(2, "0")}-${String(n).padStart(2, "0")}`;
}
function yt(e) {
	let t = String(e ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/u);
	return t ? `${t[3]}/${t[2]}/${t[1]}` : String(e ?? "");
}
function bt(e = [], t, n = e) {
	let r = Infinity, i = -Infinity, a = (e) => {
		let t = _t(e);
		t != null && (t < r && (r = t), t > i && (i = t));
	};
	a(t);
	for (let t of e) {
		let e = t?.timing ?? {};
		a(e.plannedStart), a(e.plannedFinish), a(e.contractFinish), a(e.observedStart), a(e.observedFinish);
	}
	for (let e of n ?? []) a(e?.timing?.contractFinish);
	if (!Number.isFinite(r) || !Number.isFinite(i)) return null;
	if (r === i) r -= ht, i += ht;
	else {
		let e = (i - r) * .03;
		r -= e, i += e;
	}
	let o = (e) => {
		let t = _t(e);
		return t == null ? null : Math.min(100, Math.max(0, (t - r) / (i - r) * 100));
	}, s = [], c = new Date(r);
	for (c.setUTCDate(1); c.getTime() <= i;) {
		let e = c.toISOString().slice(0, 10), t = o(e);
		t != null && s.push({
			iso: e,
			left: t,
			month: c.getUTCMonth(),
			year: c.getUTCFullYear()
		}), c.setUTCMonth(c.getUTCMonth() + 1);
	}
	return {
		pos: o,
		months: s
	};
}
function xt(e) {
	let t = e?.subject ?? {};
	return t.activityKey || (t.milestoneKey ? `milestone:${t.milestoneKey}` : null);
}
//#endregion
//#region src/react/activityAssignmentBatch.js
var St = Object.freeze({
	IDLE: "idle",
	RUNNING: "running",
	STOPPING: "stopping",
	PAUSED: "paused",
	COMPLETED: "completed"
}), Ct = Object.freeze([
	10,
	25,
	50
]), wt = Ct[0], Tt = Object.freeze({
	manual: Object.freeze({
		key: "manual",
		label: "שויך ידנית"
	}),
	agent_approved: Object.freeze({
		key: "agent-approved",
		label: "הוצע על ידי הסוכן ואושר"
	}),
	agent_auto: Object.freeze({
		key: "agent-auto",
		label: "שויך אוטומטית"
	}),
	existing: Object.freeze({
		key: "existing",
		label: "שיוך קיים"
	})
}), Et = Object.freeze({
	query: "",
	kind: "",
	dateFrom: "",
	dateTo: "",
	text: "",
	severity: "",
	status: "",
	assignmentState: "",
	activity: ""
});
function Dt(e) {
	return String(e ?? "").trim().toLocaleLowerCase("he");
}
function Ot(e = {}) {
	return Object.keys(Et).some((t) => Dt(e[t]));
}
function kt(e = [], t = [], n = {}) {
	let r = {
		...Et,
		...n
	}, i = new Map((Array.isArray(t) ? t : []).map((e) => [String(e?.key || ""), e?.name || ""])), a = Dt(r.query), o = Dt(r.text), s = Dt(r.activity);
	return (Array.isArray(e) ? e : []).filter((e) => {
		let t = String(e?.activityKey || ""), n = i.get(t) || "", c = String(e?.date || ""), l = Dt(`${e?.title || ""} ${e?.alertType || ""}`), u = Dt([
			e?.kind === "update" ? "עדכון" : "התראה",
			c,
			e?.title,
			e?.alertType,
			e?.severity,
			e?.status,
			n
		].join(" "));
		return !(a && !u.includes(a) || r.kind && e?.kind !== r.kind || r.dateFrom && (!c || c < r.dateFrom) || r.dateTo && (!c || c > r.dateTo) || o && !l.includes(o) || r.severity !== "" && String(e?.severity ?? "") !== String(r.severity) || r.status !== "" && String(e?.status || "") !== String(r.status) || r.assignmentState === "assigned" && !t || r.assignmentState === "unassigned" && t || s && !Dt(n).includes(s));
	});
}
function At(e = {}) {
	return {
		status: St.IDLE,
		queue: [],
		nextIndex: 0,
		processed: 0,
		total: 0,
		assigned: 0,
		review: 0,
		skipped: 0,
		failed: 0,
		currentId: null,
		timeFilter: !1,
		...e
	};
}
function jt(e) {
	let t = Number(e);
	return Ct.includes(t) ? t : wt;
}
function Mt(e = [], { limit: t = Infinity } = {}) {
	let n = Number.isFinite(Number(t)) ? Math.max(0, Math.floor(Number(t))) : Infinity;
	if (n === 0) return [];
	let r = /* @__PURE__ */ new Set(), i = [];
	for (let t of Array.isArray(e) ? e : []) {
		let e = String(t?.id || "").trim();
		if (!(!e || !t?.date || t?.activityKey || r.has(e)) && (r.add(e), i.push(t), i.length >= n)) break;
	}
	return i;
}
function Nt({ batchSize: e = 0, eligibleCount: t = 0 } = {}) {
	return [
		`המערכת תבדוק ${Number(e) || 0} מתוך ${Number(t) || 0} ההתראות הלא משויכות.`,
		"הריצה הקבוצתית היא במצב בדיקה בלבד ואינה כותבת שיוכים אוטומטיים.",
		"תוצאות לא ודאיות יישמרו להחלטה אנושית. להמשיך?"
	].join("\n\n");
}
function Pt(e = {}) {
	return e?.activityKey ? Tt[e.assignmentMethod] || Tt.existing : null;
}
function Ft(e, t = 2) {
	if (!e || e.status === "filtered_out" || e.decision?.autoAssigned) return [];
	let n = Math.max(0, Math.min(2, Number(t) || 0));
	return (Array.isArray(e.candidates) ? e.candidates : []).filter((e) => e?.activityKey && e?.name).slice(0, n);
}
function It(e = {}, t = {}) {
	return {
		alertTitle: String(e?.title || t?.event?.title || "").trim() || "התראה ללא כותרת",
		recommendation: t?.decision?.autoAssigned ? "שויך אוטומטית" : String(t?.decision?.selectedActivityName || "").trim() || "לא נמצאה התאמה חד-משמעית"
	};
}
function Lt(e, t) {
	let n = {
		processed: Number(e?.processed) || 0,
		assigned: Number(e?.assigned) || 0,
		review: Number(e?.review) || 0,
		skipped: Number(e?.skipped) || 0,
		failed: Number(e?.failed) || 0
	};
	return n.processed += 1, t?.ok ? t.result?.status === "filtered_out" || t.result?.timeFilter?.skipped === !0 ? n.skipped += 1 : t.result?.assignment ? n.assigned += 1 : n.review += 1 : n.failed += 1, n;
}
function Rt(e) {
	let t = Number(e?.processed) || 0, n = Number(e?.total) || 0;
	switch (e?.status) {
		case St.RUNNING: return `${e?.timeFilter ? "מסנן ובודק" : "בודק"} שורה ${Math.min(t + 1, n)} מתוך ${n}`;
		case St.STOPPING: return "בקשת העצירה נקלטה - מסיים את השורה הפעילה";
		case St.PAUSED: return `הריצה נעצרה אחרי ${t} מתוך ${n}`;
		case St.COMPLETED: return `הריצה הסתיימה: ${t} נבדקו · ${e.assigned || 0} שויכו · ${e.review || 0} הועברו להחלטה · ${e.skipped || 0} דולגו · ${e.failed || 0} נכשלו`;
		default: return "";
	}
}
//#endregion
//#region src/scheduleActivityAssignmentLabels.js
var zt = Object.freeze({
	CONFIRMED_MATCH: "confirmed_match",
	REJECTED_MATCH: "rejected_match",
	NO_MATCH: "no_match",
	STALE_ACTIVITY: "stale_activity",
	IRRELEVANT_ALERT: "irrelevant_alert",
	AMBIGUOUS: "ambiguous"
}), Bt = Object.freeze([
	zt.REJECTED_MATCH,
	zt.NO_MATCH,
	zt.STALE_ACTIVITY,
	zt.IRRELEVANT_ALERT,
	zt.AMBIGUOUS
]), Vt = Object.freeze([
	{
		type: zt.NO_MATCH,
		labelHe: "אף פעילות אינה מתאימה",
		reasonHe: "הבודק אישר שאין פעילות מתאימה בגרסת לוח הזמנים הפעילה."
	},
	{
		type: zt.AMBIGUOUS,
		labelHe: "אין מספיק מידע להכריע",
		reasonHe: "הבודק אישר שכמה פעילויות נותרו סבירות ואין די מידע להכרעה."
	},
	{
		type: zt.IRRELEVANT_ALERT,
		labelHe: "לא רלוונטי לשיוך בלוח",
		reasonHe: "הבודק אישר שההתראה אינה צריכה להיכנס לתהליך שיוך הפעילויות."
	},
	{
		type: zt.REJECTED_MATCH,
		labelHe: "ההצעות שגויות. קיימת פעילות אחרת",
		reasonHe: "הבודק דחה את הפעילויות שהוצעו אך לא קבע שאין פעילות מתאימה אחרת."
	}
]);
new Set(Object.values(zt)), new Set(Bt);
//#endregion
//#region src/react/scheduleActivityAssignmentReviewState.js
function Ht(e) {
	return String(e ?? "").trim();
}
function Ut(e = {}) {
	let t = e.event && typeof e.event == "object" ? e.event : {}, n = Ht(e.sourceId || t.id), r = Ht(t.alertType) || "החלטת צוות";
	return {
		id: n,
		sourceEventId: `alert_${n}`,
		sourceTable: "alerts",
		sourceKind: "timeline_alert_review_snapshot",
		kind: /עדכון|update/iu.test(r) ? "update" : "alert",
		alertType: r,
		title: Ht(t.title) || "התראה שנשמרה לבדיקת צוות",
		date: Ht(t.date) || null,
		severity: t.severity == null ? null : Number(t.severity),
		status: Ht(t.status) || null,
		href: null,
		activityKey: null,
		reviewSnapshot: !0
	};
}
function Wt(e = [], t = []) {
	let n = Array.isArray(e) ? e : [], r = new Map(n.map((e) => [Ht(e?.id), e])), i = /* @__PURE__ */ new Map(), a = [];
	for (let e of Array.isArray(t) ? t : []) {
		let t = Ht(e?.sourceId);
		if (!t || i.has(t)) continue;
		let n = r.get(t);
		if (n?.activityKey) continue;
		let o = !n;
		i.set(t, o ? {
			...e,
			detachedFromCurrentFeed: !0
		} : e), o && a.push(Ut(e));
	}
	let o = new Set(i.keys()), s = n.filter((e) => o.has(Ht(e?.id))), c = n.filter((e) => !o.has(Ht(e?.id)));
	return {
		items: [
			...a,
			...s,
			...c
		],
		agentResults: Object.fromEntries(i),
		detachedCount: a.length
	};
}
//#endregion
//#region src/react/SchedulePage.jsx
var Gt = {
	on_track: "בזמן",
	watch: "במעקב",
	at_risk: "בסיכון",
	delayed_vs_contractor: "באיחור מול לוח הקבלן",
	delayed_vs_contract: "באיחור מול החוזה",
	milestone_at_risk: "אבן דרך בסיכון",
	milestone_delayed: "אבן דרך באיחור",
	hidden_slippage: "דחיית לו\"ז שקטה",
	completed_late: "הושלמה באיחור",
	completed_on_time: "הושלמה בזמן",
	insufficient_data: "נתונים חסרים",
	source_conflict: "סתירה בין מקורות",
	not_started: "טרם החלה",
	blocked: "חסומה"
}, Kt = {
	on_track: "ok",
	completed_on_time: "ok",
	watch: "watch",
	at_risk: "warn",
	milestone_at_risk: "warn",
	hidden_slippage: "warn",
	completed_late: "warn",
	delayed_vs_contractor: "bad",
	delayed_vs_contract: "bad",
	milestone_delayed: "bad",
	blocked: "bad",
	source_conflict: "conflict",
	insufficient_data: "unknown",
	not_started: "idle"
}, qt = {
	contract_finish: "החוזה",
	contractor_planned_finish: "לוח הקבלן",
	forecast_finish: "תחזית"
}, Jt = {
	contractAxis: "ציר חוזי",
	scheduleVersions: "גרסאות לוח",
	dependencies: "תלויות",
	observedEvents: "אירועי שטח",
	calendar: "לוח שנה"
}, Yt = [
	"ינו",
	"פבר",
	"מרץ",
	"אפר",
	"מאי",
	"יוני",
	"יולי",
	"אוג",
	"ספט",
	"אוק",
	"נוב",
	"דצמ"
], Xt = 120;
async function Zt(e, { method: t = "GET", body: n = null, timeoutMs: r = 12e4, cache: i = "default" } = {}) {
	let a = new AbortController(), o = setTimeout(() => a.abort(), r);
	try {
		let r = await fetch(e, {
			method: t,
			headers: n ? { "Content-Type": "application/json" } : void 0,
			body: n ? JSON.stringify(n) : void 0,
			cache: i,
			signal: a.signal
		}), o = await r.json().catch(() => ({}));
		if (!r.ok) throw Error(o.error || `HTTP ${r.status}`);
		return o;
	} finally {
		clearTimeout(o);
	}
}
function Qt(e = []) {
	let t = e.map(({ label: e, error: t }) => `${e}: ${t?.message || "שגיאה לא ידועה"}`), n = /(?:522|connection terminated|connection timeout|failed to fetch|abort|timeout)/iu;
	return `${t.some((e) => n.test(e)) ? "APP DATA אינו זמין כרגע (522/timeout). נתוני לוח הזמנים המוצגים חלקיים או אינם זמינים." : "לא ניתן היה להשלים את טעינת נתוני לוח הזמנים. הנתונים המוצגים עשויים להיות חלקיים."} לא בוצע שינוי בנתונים. אפשר לנסות שוב לאחר שחיבור Supabase יתאושש.`;
}
function $t(e) {
	if (!e) return "—";
	if (e.daysLate != null) {
		let t = e.workingDaysLate == null ? "" : ` (${e.workingDaysLate} ימי עבודה)`;
		return `באיחור ${e.daysLate} ימים${t}`;
	}
	if (e.daysRemaining != null) {
		if (e.daysRemaining === 0) return "היום";
		let t = e.workingDaysRemaining == null ? "" : ` (${e.workingDaysRemaining} ימי עבודה)`;
		return `נותרו ${e.daysRemaining} ימים${t}`;
	}
	return "—";
}
function en(e) {
	return !e?.basis || !e?.basisDate ? "ללא בסיס" : `מול ${qt[e.basis] ?? e.basis}: ${e.basisDate}`;
}
var tn = ({ status: e }) => /* @__PURE__ */ (0, x.jsx)("span", {
	className: `schedBadge schedTone-${Kt[e] ?? "unknown"}`,
	children: Gt[e] ?? e
}), nn = ({ confidence: e }) => {
	if (!e) return null;
	let t = e.level ?? "low", n = t === "high" ? "ביטחון גבוה" : t === "medium" ? "ביטחון בינוני" : "ביטחון נמוך";
	return /* @__PURE__ */ (0, x.jsxs)("span", {
		className: `schedBadge schedConf-${t}`,
		title: `ציון: ${e.score}`,
		children: [t === "low" ? "⚠ " : "", n]
	});
}, rn = ({ gates: e, compact: t = !1 }) => e ? /* @__PURE__ */ (0, x.jsxs)("div", {
	className: `schedGates ${t ? "is-compact" : ""}`,
	children: [!t && /* @__PURE__ */ (0, x.jsx)("span", {
		className: "schedGatesTitle",
		children: "מה נבדק:"
	}), Object.entries(Jt).map(([t, n]) => {
		let r = e[t], i = r === "ok" || t === "scheduleVersions" && Number(r) > 1, a = t === "scheduleVersions" ? `${n}: ${r}` : n;
		return /* @__PURE__ */ (0, x.jsxs)("span", {
			className: `schedGate ${i ? "is-ok" : r === "stale" ? "is-stale" : "is-missing"}`,
			title: r === "missing" ? "לא זמין — לא נבדק, לא נלקח בחשבון" : r === "stale" ? "קיים אך לא מעודכן" : "נבדק",
			children: [
				i ? "✓" : r === "stale" ? "◐" : "✗",
				" ",
				a
			]
		}, t);
	})]
}) : null, an = ({ showLateLines: e = !0 }) => /* @__PURE__ */ (0, x.jsxs)("div", {
	className: "axisLegend",
	children: [
		/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("i", { className: "axisSwatch swPlan" }), " תכנון הקבלן"] }),
		/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("i", { className: "axisSwatch swFill" }), " % ביצוע מדווח"] }),
		e ? /* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("i", { className: "axisSwatch swLate" }), " חריגה עד \"נכון ל-\""] }) : null,
		/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("i", {
			className: "axisSwatch swForecast",
			children: "◆"
		}), " תחזית סיום"] }),
		/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("i", {
			className: "axisSwatch swContract",
			children: "⚑"
		}), " אבן דרך חוזית"] }),
		/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("i", {
			className: "axisSwatch swTrigger",
			children: "▶"
		}), " תחילת ספירה חוזית"] }),
		/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("i", { className: "axisSwatch swObserved" }), " ביצוע נצפה (BIDoc)"] }),
		/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("i", {
			className: "axisSwatch swActivityEvent",
			children: "●"
		}), " עדכון / התראה משויכים"] }),
		/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("i", { className: "axisSwatch swToday" }), " קו \"נכון ל-\""] })
	]
});
function on({ indicator: e, scale: t, asOf: n, showLateLines: r = !0, selected: i, onSelect: a, eventCount: o = 0, expanded: s = !1, onToggleEvents: c }) {
	let l = e.timing ?? {}, u = e.lateness ?? {}, d = t.pos(l.plannedStart), f = t.pos(l.plannedFinish), p = t.pos(l.contractFinish), m = t.pos(l.forecastFinish), h = t.pos(l.observedStart), g = t.pos(l.observedFinish), _ = t.pos(u.basisDate), v = t.pos(n), y = l.percentComplete, b = u.isLate === !0;
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		className: `axisRow ${i ? "is-selected" : ""}`,
		onClick: () => a(e),
		children: [/* @__PURE__ */ (0, x.jsxs)("div", {
			className: "axisTrack",
			dir: "ltr",
			children: [
				/* @__PURE__ */ (0, x.jsx)("div", {
					className: "axisLane",
					children: p == null ? null : /* @__PURE__ */ (0, x.jsx)("span", {
						className: "axisContractFlag",
						style: { left: `${p}%` },
						title: `מועד חוזי: ${l.contractFinish}`,
						children: "⚑"
					})
				}),
				/* @__PURE__ */ (0, x.jsxs)("div", {
					className: "axisLane",
					children: [d != null && f != null && /* @__PURE__ */ (0, x.jsx)("div", {
						className: `axisBarPlan ${e.subject.isMilestone ? "is-milestone" : ""}`,
						style: {
							left: `${d}%`,
							width: `${Math.max(f - d, .6)}%`
						},
						title: `תכנון: ${l.plannedStart} → ${l.plannedFinish}`,
						children: y != null && y > 0 ? /* @__PURE__ */ (0, x.jsx)("div", {
							className: "axisBarFill",
							style: { width: `${y}%` },
							title: `${y}% ביצוע מדווח`
						}) : null
					}), r && b && _ != null && v != null && v > _ && /* @__PURE__ */ (0, x.jsx)("div", {
						className: "axisBarLate",
						style: {
							left: `${_}%`,
							width: `${v - _}%`
						},
						title: `${$t(u)} — ${en(u)}`
					})]
				}),
				/* @__PURE__ */ (0, x.jsx)("div", {
					className: "axisLane",
					children: h != null || g != null ? /* @__PURE__ */ (0, x.jsx)("div", {
						className: "axisBarObserved",
						style: {
							left: `${h ?? g}%`,
							width: `${Math.max((g ?? h) - (h ?? g), .6)}%`
						},
						title: `ביצוע נצפה: ${l.observedStart ?? "?"} → ${l.observedFinish ?? "?"}`
					}) : m == null ? null : /* @__PURE__ */ (0, x.jsx)("span", {
						className: "axisForecast",
						style: { left: `${m}%` },
						title: `תחזית סיום: ${l.forecastFinish}`,
						children: "◆"
					})
				})
			]
		}), /* @__PURE__ */ (0, x.jsxs)("div", {
			className: "axisName",
			children: [/* @__PURE__ */ (0, x.jsxs)("span", {
				className: "axisNameTitleLine",
				children: [o ? /* @__PURE__ */ (0, x.jsxs)("button", {
					type: "button",
					className: "axisExpandBtn",
					"aria-expanded": s,
					"aria-label": `${s ? "סגור" : "פתח"} ${o} עדכונים והתראות`,
					onClick: (e) => {
						e.stopPropagation(), c();
					},
					children: [s ? "▾" : "◂", /* @__PURE__ */ (0, x.jsx)("b", { children: o })]
				}) : null, /* @__PURE__ */ (0, x.jsxs)("span", {
					className: "axisNameText",
					title: e.subject.name,
					children: [e.subject.isMilestone ? "◆ " : "", e.subject.name]
				})]
			}), /* @__PURE__ */ (0, x.jsxs)("span", {
				className: "axisNameMeta",
				children: [/* @__PURE__ */ (0, x.jsx)(tn, { status: e.status }), /* @__PURE__ */ (0, x.jsx)("span", {
					className: "axisLateText",
					children: $t(u)
				})]
			})]
		})]
	});
}
function sn({ item: e, scale: t }) {
	let n = t.pos(e.date);
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		className: "axisEventRow",
		children: [/* @__PURE__ */ (0, x.jsx)("div", {
			className: "axisTrack",
			dir: "ltr",
			children: n == null ? null : /* @__PURE__ */ (0, x.jsx)("span", {
				className: `axisEventPoint is-${e.kind}`,
				style: { left: `${n}%` },
				title: `${e.alertType} · ${e.date} · ${e.title}`,
				children: "●"
			})
		}), /* @__PURE__ */ (0, x.jsxs)("div", {
			className: "axisName axisEventName",
			children: [
				/* @__PURE__ */ (0, x.jsx)("span", {
					className: `activityUpdateKind is-${e.kind}`,
					children: e.kind === "update" ? "עדכון" : "התראה"
				}),
				/* @__PURE__ */ (0, x.jsx)("span", {
					className: "axisNameText",
					title: e.title,
					children: e.title
				}),
				/* @__PURE__ */ (0, x.jsx)("time", { children: e.date || "ללא תאריך" })
			]
		})]
	});
}
function cn({ indicators: e, allIndicators: t, pendingConditions: n, timelineItems: r, asOf: i, showLateLines: a, showAsOfMarker: o, selected: s, onSelect: c }) {
	let [l, u] = (0, b.useState)(() => /* @__PURE__ */ new Set()), d = (0, b.useMemo)(() => (n ?? []).flatMap((e) => {
		let t = e?.metadata?.trigger_evidence?.provisionalDueDate;
		return t ? [{
			date: t,
			name: e.name || "אבן דרך חוזית",
			provisional: !0
		}] : [];
	}), [n]), f = (0, b.useMemo)(() => {
		let e = /* @__PURE__ */ new Map();
		for (let t of n ?? []) {
			let n = t?.trigger_event_date;
			if (!n) continue;
			let r = e.get(n) || {
				date: n,
				names: []
			}, i = t.name || "נקודת זמן חוזית";
			r.names.includes(i) || r.names.push(i), e.set(n, r);
		}
		return [...e.values()].map((e) => ({
			date: e.date,
			name: e.names.join(" · "),
			count: e.names.length
		}));
	}, [n]), p = (0, b.useMemo)(() => [
		...t ?? e,
		...d.map((e) => ({ timing: { contractFinish: e.date } })),
		...f.map((e) => ({ timing: { contractFinish: e.date } })),
		...(r ?? []).filter((e) => e.activityKey && e.date).map((e) => ({ timing: { contractFinish: e.date } }))
	], [
		t,
		e,
		d,
		f,
		r
	]), m = o ? e : t ?? e, h = (0, b.useMemo)(() => bt(m, o ? i : null, p), [
		m,
		p,
		i,
		o
	]), g = (0, b.useMemo)(() => {
		let n = /* @__PURE__ */ new Map();
		for (let r of t ?? e) {
			let e = r.timing?.contractFinish;
			!e || n.has(e) || n.set(e, {
				date: e,
				name: r.subject?.milestoneKey ? r.subject.name : "אבן דרך חוזית"
			});
		}
		for (let e of d) n.has(e.date) || n.set(e.date, e);
		return [...n.values()];
	}, [
		e,
		t,
		d
	]), _ = (0, b.useMemo)(() => {
		let e = /* @__PURE__ */ new Map();
		for (let t of r ?? []) {
			if (!t.activityKey || !t.date) continue;
			let n = e.get(t.activityKey) || [];
			n.push(t), e.set(t.activityKey, n);
		}
		for (let t of e.values()) t.sort((e, t) => String(e.date).localeCompare(String(t.date)));
		return e;
	}, [r]), v = (e) => u((t) => {
		let n = new Set(t);
		return n.has(e) ? n.delete(e) : n.add(e), n;
	});
	if (!h) return /* @__PURE__ */ (0, x.jsx)("div", {
		className: "schedEmpty",
		children: "אין תאריכים להצגה"
	});
	let y = e.slice(0, Xt), S = o ? h.pos(i) : null, C = a && o;
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		className: "axesView",
		children: [
			/* @__PURE__ */ (0, x.jsx)(an, { showLateLines: C }),
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "axesBody",
				children: [/* @__PURE__ */ (0, x.jsxs)("div", {
					className: "axesTimeArea",
					dir: "ltr",
					children: [/* @__PURE__ */ (0, x.jsx)("div", {
						className: "axesMonths",
						children: h.months.map((e) => /* @__PURE__ */ (0, x.jsxs)("span", {
							className: "axesMonthTick",
							style: { left: `${e.left}%` },
							children: [
								Yt[e.month],
								" ",
								String(e.year).slice(2)
							]
						}, e.iso))
					}), /* @__PURE__ */ (0, x.jsxs)("div", {
						className: "axesRowsOverlay",
						children: [
							h.months.map((e) => /* @__PURE__ */ (0, x.jsx)("span", {
								className: "axesGridLine",
								style: { left: `${e.left}%` }
							}, e.iso)),
							f.map((e) => {
								let t = h.pos(e.date);
								if (t == null) return null;
								let n = `תחילת ספירה: ${e.name} · ${yt(e.date)}`;
								return /* @__PURE__ */ (0, x.jsx)("span", {
									className: "axesTriggerLine",
									style: { left: `${t}%` },
									title: n,
									children: /* @__PURE__ */ (0, x.jsxs)("label", { children: [
										"▶ ",
										n,
										e.count > 1 ? ` (${e.count})` : ""
									] })
								}, `trigger:${e.date}`);
							}),
							g.map((e) => {
								let t = h.pos(e.date);
								return t == null ? null : /* @__PURE__ */ (0, x.jsx)("span", {
									className: `axesContractLine ${e.provisional ? "is-provisional" : ""}`,
									style: { left: `${t}%` },
									title: e.provisional ? "מועד משוער בלבד — ממתין להשלמת לוח ימי העבודה והחגים" : void 0,
									children: /* @__PURE__ */ (0, x.jsxs)("label", { children: [
										"⚑ ",
										e.provisional ? "משוער: " : "",
										e.name,
										" · ",
										e.date
									] })
								}, `${e.date}:${e.name}`);
							}),
							S != null && /* @__PURE__ */ (0, x.jsx)("span", {
								className: "axesTodayLine",
								style: { left: `${S}%` },
								children: /* @__PURE__ */ (0, x.jsxs)("label", { children: ["נכון ל-", i] })
							})
						]
					})]
				}), /* @__PURE__ */ (0, x.jsx)("div", {
					className: "axesRows",
					children: y.map((e) => {
						let t = xt(e), n = _.get(t) || [], r = l.has(t);
						return /* @__PURE__ */ (0, x.jsxs)(b.Fragment, { children: [/* @__PURE__ */ (0, x.jsx)(on, {
							indicator: e,
							scale: h,
							asOf: i,
							showLateLines: C,
							selected: xt(s) === t,
							onSelect: c,
							eventCount: n.length,
							expanded: r,
							onToggleEvents: () => v(t)
						}), r ? n.map((e) => /* @__PURE__ */ (0, x.jsx)(sn, {
							item: e,
							scale: h
						}, `${e.sourceTable}:${e.id}`)) : null] }, t);
					})
				})]
			}),
			e.length > Xt ? /* @__PURE__ */ (0, x.jsxs)("div", {
				className: "axesCapNote",
				children: [
					"מוצגות ",
					Xt,
					" הפעילויות החמורות מתוך ",
					e.length,
					" — צמצם עם הפילטרים למעלה"
				]
			}) : null
		]
	});
}
function ln({ activities: e, value: t, disabled: n, busy: r, onChange: i }) {
	let a = (0, b.useRef)(null), [o, s] = (0, b.useState)(""), c = e.find((e) => e.key === t), l = e.filter((e) => `${e.name} ${e.dateLabel}`.toLocaleLowerCase("he").includes(o.trim().toLocaleLowerCase("he"))).slice(0, 80), u = (e) => {
		i(e), s(""), a.current && (a.current.open = !1);
	};
	return /* @__PURE__ */ (0, x.jsxs)("details", {
		ref: a,
		className: "activityPicker",
		children: [/* @__PURE__ */ (0, x.jsx)("summary", {
			className: t ? "" : "is-empty",
			"aria-disabled": n || r,
			onClick: (e) => {
				(n || r) && e.preventDefault();
			},
			children: r ? "שומר…" : c ? `${c.name} · ${c.dateLabel}` : "בחר פעילות"
		}), /* @__PURE__ */ (0, x.jsxs)("div", {
			className: "activityPickerMenu",
			children: [
				/* @__PURE__ */ (0, x.jsx)("input", {
					type: "search",
					value: o,
					onChange: (e) => s(e.target.value),
					placeholder: "חיפוש פעילות…",
					autoFocus: !0
				}),
				t ? /* @__PURE__ */ (0, x.jsx)("button", {
					type: "button",
					className: "activityPickerClear",
					onClick: () => u(null),
					children: "נקה שיוך"
				}) : null,
				/* @__PURE__ */ (0, x.jsxs)("div", {
					className: "activityPickerOptions",
					children: [l.map((e) => /* @__PURE__ */ (0, x.jsxs)("button", {
						type: "button",
						className: e.key === t ? "is-selected" : "",
						onClick: () => u(e.key),
						title: e.name,
						children: [/* @__PURE__ */ (0, x.jsx)("span", { children: e.name }), /* @__PURE__ */ (0, x.jsx)("small", { children: e.dateLabel })]
					}, e.key)), l.length ? null : /* @__PURE__ */ (0, x.jsx)("span", {
						className: "activityPickerEmpty",
						children: "לא נמצאה פעילות"
					})]
				})
			]
		})]
	});
}
function un({ items: e, activities: t, busyId: n, onAssign: r, agentBusyId: i, agentResults: a, onRunAgent: o, onConfirmAgent: s, onRejectAgent: c, agentBatch: l, onStartAgentBatch: u, onStopAgentBatch: d, onResumeAgentBatch: f, onRestartAgentBatch: p, timeFilterEnabled: m, onTimeFilterChange: h, batchLimit: g, onBatchLimitChange: _, labelCoverage: v }) {
	let [y, S] = (0, b.useState)(() => ({ ...Et })), [C, w] = (0, b.useState)(100), T = (0, b.useDeferredValue)(y.query), E = (0, b.useDeferredValue)(y.text), D = (0, b.useDeferredValue)(y.activity), O = (0, b.useMemo)(() => ({
		...y,
		query: T,
		text: E,
		activity: D
	}), [
		y,
		T,
		E,
		D
	]), k = (0, b.useMemo)(() => kt(e, t, O), [
		e,
		t,
		O
	]), A = k.filter((e) => e.activityKey).length, j = Object.values(a || {}).filter((e) => e?.persistedReview && !e?.approved && !e?.rejected).length, M = (0, b.useMemo)(() => Mt(k).length, [k]), N = Math.min(M, jt(g)), ee = (0, b.useMemo)(() => [...new Set(e.map((e) => e.severity).filter((e) => e != null))].sort((e, t) => Number(e) - Number(t)), [e]), P = (0, b.useMemo)(() => [...new Set(e.map((e) => String(e.status || "").trim()).filter(Boolean))].sort((e, t) => e.localeCompare(t, "he")), [e]), F = Ot(y), I = (0, b.useCallback)((e, t) => {
		S((n) => ({
			...n,
			[e]: t
		})), w(100);
	}, []), te = (0, b.useCallback)(() => {
		S({ ...Et }), w(100);
	}, []), L = l.status === St.RUNNING || l.status === St.STOPPING, ne = !!(i || n), re = Rt(l);
	return /* @__PURE__ */ (0, x.jsxs)("section", {
		className: "activityUpdatesPanel",
		"aria-labelledby": "activity-updates-title",
		children: [
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "activityUpdatesHead",
				children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("h3", {
					id: "activity-updates-title",
					children: "עדכונים והתראות על ציר הזמן"
				}), /* @__PURE__ */ (0, x.jsxs)("p", {
					"aria-live": "polite",
					children: [
						F ? `${k.length} מתוך ${e.length}` : e.length,
						" פריטים · ",
						A,
						" משויכים לפעילות",
						j ? ` · ${j} ממתינים להחלטת צוות` : "",
						v ? ` · ${v.caseCount || 0} תוויות כיול מפורשות` : ""
					]
				})] }), /* @__PURE__ */ (0, x.jsxs)("div", {
					className: "activityUpdatesHeadTools",
					children: [
						/* @__PURE__ */ (0, x.jsxs)("div", {
							className: "activityAgentBatchControls",
							"aria-label": "בדיקה קבוצתית של התראות לא משויכות",
							children: [
								/* @__PURE__ */ (0, x.jsxs)("label", {
									className: "activityAgentBatchLimit",
									children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "כמות לבדיקה" }), /* @__PURE__ */ (0, x.jsx)("select", {
										value: g,
										disabled: L,
										onChange: (e) => _(jt(e.target.value)),
										children: Ct.map((e) => /* @__PURE__ */ (0, x.jsx)("option", {
											value: e,
											children: e
										}, e))
									})]
								}),
								/* @__PURE__ */ (0, x.jsxs)("label", {
									className: "activityAgentTimeFilter",
									title: "בריצה קבוצתית בלבד: דלג על התראות שאינן קשורות לזמן, עיכוב, תאריך או לוח זמנים",
									children: [/* @__PURE__ */ (0, x.jsx)("input", {
										type: "checkbox",
										checked: m,
										disabled: L,
										onChange: (e) => h(e.target.checked)
									}), /* @__PURE__ */ (0, x.jsx)("span", { children: "סינון זמן" })]
								}),
								l.status === St.PAUSED ? /* @__PURE__ */ (0, x.jsxs)(x.Fragment, { children: [/* @__PURE__ */ (0, x.jsx)("button", {
									type: "button",
									className: "activityAgentBatchButton is-primary",
									disabled: ne,
									onClick: f,
									children: "המשך מאותה נקודה"
								}), /* @__PURE__ */ (0, x.jsx)("button", {
									type: "button",
									className: "activityAgentBatchButton",
									disabled: ne || !M,
									onClick: () => p(k, g),
									children: "הרץ מחדש"
								})] }) : l.status === St.COMPLETED ? /* @__PURE__ */ (0, x.jsx)("button", {
									type: "button",
									className: "activityAgentBatchButton",
									disabled: !M,
									onClick: () => p(k, g),
									children: "הרץ מחדש"
								}) : /* @__PURE__ */ (0, x.jsxs)(x.Fragment, { children: [/* @__PURE__ */ (0, x.jsx)("button", {
									type: "button",
									className: "activityAgentBatchButton is-primary",
									disabled: L || ne || !M,
									onClick: () => u(k, g),
									children: M ? `בדוק ${N} מתוך ${M} לא משויכות` : "אין התראות לא משויכות לבדיקה"
								}), L ? /* @__PURE__ */ (0, x.jsx)("button", {
									type: "button",
									className: "activityAgentBatchButton is-stop",
									disabled: l.status === St.STOPPING,
									onClick: d,
									children: l.status === St.STOPPING ? "עוצר…" : "עצור"
								}) : null] })
							]
						}),
						M ? /* @__PURE__ */ (0, x.jsxs)("p", {
							className: "activityAgentBatchExplanation",
							children: [M, " התראות ממתינות לבדיקה. המספר אינו מציין שיוכים שבוצעו."]
						}) : null,
						re ? /* @__PURE__ */ (0, x.jsxs)("div", {
							className: `activityAgentBatchStatus is-${l.status}`,
							role: "status",
							"aria-live": "polite",
							children: [/* @__PURE__ */ (0, x.jsx)("progress", {
								max: Math.max(l.total, 1),
								value: l.processed,
								"aria-label": re
							}), /* @__PURE__ */ (0, x.jsx)("span", { children: re })]
						}) : null,
						/* @__PURE__ */ (0, x.jsxs)("div", {
							className: "activityUpdatesGlobalFilter",
							children: [/* @__PURE__ */ (0, x.jsx)("input", {
								type: "search",
								value: y.query,
								onChange: (e) => I("query", e.target.value),
								placeholder: "חיפוש כללי בעדכונים והתראות…",
								"aria-label": "חיפוש כללי בעדכונים והתראות"
							}), /* @__PURE__ */ (0, x.jsx)("button", {
								type: "button",
								onClick: te,
								disabled: !F,
								children: "נקה מסננים"
							})]
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, x.jsx)("div", {
				className: "activityUpdatesTableWrap",
				children: /* @__PURE__ */ (0, x.jsxs)("table", {
					className: "activityUpdatesTable",
					children: [/* @__PURE__ */ (0, x.jsxs)("thead", { children: [/* @__PURE__ */ (0, x.jsxs)("tr", {
						className: "activityUpdatesHeaderRow",
						children: [
							/* @__PURE__ */ (0, x.jsx)("th", { children: "סוג" }),
							/* @__PURE__ */ (0, x.jsx)("th", { children: "תאריך" }),
							/* @__PURE__ */ (0, x.jsx)("th", { children: "התראה / עדכון" }),
							/* @__PURE__ */ (0, x.jsx)("th", { children: "חומרה" }),
							/* @__PURE__ */ (0, x.jsx)("th", { children: "סטטוס" }),
							/* @__PURE__ */ (0, x.jsx)("th", { children: "שיוך לפעילות בלוח" })
						]
					}), /* @__PURE__ */ (0, x.jsxs)("tr", {
						className: "activityUpdatesFilterRow",
						children: [
							/* @__PURE__ */ (0, x.jsx)("th", { children: /* @__PURE__ */ (0, x.jsxs)("select", {
								value: y.kind,
								onChange: (e) => I("kind", e.target.value),
								"aria-label": "סינון לפי סוג",
								children: [
									/* @__PURE__ */ (0, x.jsx)("option", {
										value: "",
										children: "כל הסוגים"
									}),
									/* @__PURE__ */ (0, x.jsx)("option", {
										value: "alert",
										children: "התראות"
									}),
									/* @__PURE__ */ (0, x.jsx)("option", {
										value: "update",
										children: "עדכונים"
									})
								]
							}) }),
							/* @__PURE__ */ (0, x.jsx)("th", { children: /* @__PURE__ */ (0, x.jsxs)("div", {
								className: "activityUpdatesDateFilter",
								children: [/* @__PURE__ */ (0, x.jsxs)("label", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "מ־" }), /* @__PURE__ */ (0, x.jsx)("input", {
									type: "date",
									value: y.dateFrom,
									max: y.dateTo || void 0,
									onChange: (e) => I("dateFrom", e.target.value),
									"aria-label": "סינון מתאריך"
								})] }), /* @__PURE__ */ (0, x.jsxs)("label", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "עד" }), /* @__PURE__ */ (0, x.jsx)("input", {
									type: "date",
									value: y.dateTo,
									min: y.dateFrom || void 0,
									onChange: (e) => I("dateTo", e.target.value),
									"aria-label": "סינון עד תאריך"
								})] })]
							}) }),
							/* @__PURE__ */ (0, x.jsx)("th", { children: /* @__PURE__ */ (0, x.jsx)("input", {
								type: "search",
								value: y.text,
								onChange: (e) => I("text", e.target.value),
								placeholder: "חיפוש בתוכן…",
								"aria-label": "סינון לפי תוכן ההתראה או העדכון"
							}) }),
							/* @__PURE__ */ (0, x.jsx)("th", { children: /* @__PURE__ */ (0, x.jsxs)("select", {
								value: y.severity,
								onChange: (e) => I("severity", e.target.value),
								"aria-label": "סינון לפי חומרה",
								children: [/* @__PURE__ */ (0, x.jsx)("option", {
									value: "",
									children: "הכול"
								}), ee.map((e) => /* @__PURE__ */ (0, x.jsx)("option", {
									value: e,
									children: e
								}, e))]
							}) }),
							/* @__PURE__ */ (0, x.jsx)("th", { children: /* @__PURE__ */ (0, x.jsxs)("select", {
								value: y.status,
								onChange: (e) => I("status", e.target.value),
								"aria-label": "סינון לפי סטטוס",
								children: [/* @__PURE__ */ (0, x.jsx)("option", {
									value: "",
									children: "כל הסטטוסים"
								}), P.map((e) => /* @__PURE__ */ (0, x.jsx)("option", {
									value: e,
									children: e
								}, e))]
							}) }),
							/* @__PURE__ */ (0, x.jsx)("th", { children: /* @__PURE__ */ (0, x.jsxs)("div", {
								className: "activityUpdatesAssignmentFilter",
								children: [/* @__PURE__ */ (0, x.jsxs)("select", {
									value: y.assignmentState,
									onChange: (e) => I("assignmentState", e.target.value),
									"aria-label": "סינון לפי מצב שיוך",
									children: [
										/* @__PURE__ */ (0, x.jsx)("option", {
											value: "",
											children: "כל השיוכים"
										}),
										/* @__PURE__ */ (0, x.jsx)("option", {
											value: "assigned",
											children: "משויכים בלבד"
										}),
										/* @__PURE__ */ (0, x.jsx)("option", {
											value: "unassigned",
											children: "לא משויכים"
										})
									]
								}), /* @__PURE__ */ (0, x.jsx)("input", {
									type: "search",
									value: y.activity,
									onChange: (e) => I("activity", e.target.value),
									placeholder: "שם פעילות…",
									"aria-label": "סינון לפי שם הפעילות המשויכת"
								})]
							}) })
						]
					})] }), /* @__PURE__ */ (0, x.jsxs)("tbody", { children: [k.slice(0, C).map((e) => {
						let l = a?.[e.id], u = i === e.id, d = Ft(l), f = It(e, l), p = u || n === e.id || L, m = !!(l?.runId && l?.auditPersisted), h = !!(l?.persistedReview && l?.reviewId), g = Pt(e);
						return /* @__PURE__ */ (0, x.jsxs)(b.Fragment, { children: [/* @__PURE__ */ (0, x.jsxs)("tr", {
							className: e.activityKey ? "is-assigned" : "",
							children: [
								/* @__PURE__ */ (0, x.jsx)("td", { children: /* @__PURE__ */ (0, x.jsx)("span", {
									className: `activityUpdateKind is-${e.kind}`,
									children: e.kind === "update" ? "עדכון" : "התראה"
								}) }),
								/* @__PURE__ */ (0, x.jsx)("td", {
									className: "activityUpdateDate",
									children: e.date || /* @__PURE__ */ (0, x.jsx)("span", {
										title: "נדרש data_date אמיתי",
										children: "ללא תאריך"
									})
								}),
								/* @__PURE__ */ (0, x.jsxs)("td", { children: [/* @__PURE__ */ (0, x.jsx)("div", {
									className: "activityUpdateTitle",
									title: e.title,
									children: e.href ? /* @__PURE__ */ (0, x.jsx)("a", {
										href: e.href,
										target: "_blank",
										rel: "noreferrer",
										children: e.title
									}) : e.title
								}), /* @__PURE__ */ (0, x.jsx)("small", { children: e.alertType })] }),
								/* @__PURE__ */ (0, x.jsx)("td", { children: e.severity ?? "—" }),
								/* @__PURE__ */ (0, x.jsx)("td", { children: e.status || "—" }),
								/* @__PURE__ */ (0, x.jsx)("td", { children: /* @__PURE__ */ (0, x.jsxs)("div", {
									className: "activityAssignmentActions",
									children: [/* @__PURE__ */ (0, x.jsx)(ln, {
										activities: t,
										value: e.activityKey,
										disabled: !e.date || L || l?.detachedFromCurrentFeed,
										busy: n === e.id,
										onChange: (t) => r(e, t)
									}), g ? /* @__PURE__ */ (0, x.jsx)("span", {
										className: `activityAssignmentMethod is-${g.key}`,
										children: g.label
									}) : /* @__PURE__ */ (0, x.jsx)("button", {
										type: "button",
										className: "activityAgentButton",
										disabled: !e.date || u || n === e.id || L || l?.detachedFromCurrentFeed,
										onClick: () => o(e),
										title: "בדוק התאמה והצג הצעות לפעילות עבור שורה זו",
										children: u ? "בודק התאמה…" : "בדיקת התאמה"
									})]
								}) })
							]
						}), l ? /* @__PURE__ */ (0, x.jsx)("tr", {
							className: "activityAgentResultRow",
							children: /* @__PURE__ */ (0, x.jsx)("td", {
								colSpan: 6,
								children: l.error ? /* @__PURE__ */ (0, x.jsx)("div", {
									className: "activityAgentResult is-error",
									children: l.error
								}) : l.status === "filtered_out" ? /* @__PURE__ */ (0, x.jsxs)("div", {
									className: "activityAgentResult is-filtered",
									children: [/* @__PURE__ */ (0, x.jsxs)("div", {
										className: "activityAgentResultHead",
										children: [/* @__PURE__ */ (0, x.jsx)("strong", { children: "דולג על ידי סינון זמן" }), /* @__PURE__ */ (0, x.jsxs)("span", { children: [
											"ביטחון ",
											l.timeFilter?.confidence ?? 0,
											"%"
										] })]
									}), /* @__PURE__ */ (0, x.jsx)("p", { children: l.timeFilter?.reason || "ההתראה אינה קשורה לזמן, עיכוב, תאריך או לוח זמנים." })]
								}) : /* @__PURE__ */ (0, x.jsxs)("div", {
									className: `activityAgentResult ${l.decision?.autoAssigned ? "is-auto" : ""}`,
									children: [
										/* @__PURE__ */ (0, x.jsxs)("div", {
											className: "activityAgentResultHead",
											children: [/* @__PURE__ */ (0, x.jsxs)("div", {
												className: "activityAgentResultIdentity",
												children: [
													/* @__PURE__ */ (0, x.jsx)("small", { children: "ההתראה שנבדקת" }),
													/* @__PURE__ */ (0, x.jsx)("strong", {
														title: f.alertTitle,
														children: f.alertTitle
													}),
													/* @__PURE__ */ (0, x.jsxs)("span", { children: [
														/* @__PURE__ */ (0, x.jsx)("b", { children: "הצעת הסוכן המובילה:" }),
														" ",
														f.recommendation
													] })
												]
											}), /* @__PURE__ */ (0, x.jsxs)("span", {
												className: "activityAgentResultScore",
												children: [
													"ציון התאמה ",
													l.decision?.rankingScore ?? l.decision?.confidence ?? 0,
													` · פער ${l.decision?.rankingGap ?? l.decision?.margin ?? 0}`,
													Number.isFinite(l.decision?.calibratedProbability) ? ` · הסתברות מכוילת ${Math.round(l.decision.calibratedProbability * 100)}%` : ""
												]
											})]
										}),
										l.persistedReview ? /* @__PURE__ */ (0, x.jsx)("span", {
											className: `activityAgentSharedReviewBadge ${l.approved || l.rejected ? "is-resolved" : ""}`,
											children: l.approved ? "נבחרה פעילות · הרשומה סומנה כטופלה" : l.rejected ? "ההצעות נדחו · הרשומה סומנה כטופלה" : "כרטיס הבדיקה נשמר · ממתין להחלטת צוות"
										}) : null,
										l.detachedFromCurrentFeed ? /* @__PURE__ */ (0, x.jsx)("small", {
											className: "activityAgentWarning",
											children: "ההתראה המקורית אינה נמצאת עוד בפיד הפעיל. ההחלטה תישמר כתווית כיול בלבד ולא תשנה שיוך בלוח."
										}) : null,
										/* @__PURE__ */ (0, x.jsx)("p", { children: l.decision?.reason }),
										d.length ? /* @__PURE__ */ (0, x.jsxs)("div", {
											className: "activityAgentReview",
											"aria-label": "בחירת פעילות מתוך הצעות הסוכן",
											children: [/* @__PURE__ */ (0, x.jsx)("strong", {
												className: "activityAgentReviewPrompt",
												children: "נדרשת החלטה שלך - בחר את הפעילות המתאימה:"
											}), /* @__PURE__ */ (0, x.jsxs)("div", {
												className: "activityAgentCandidates",
												role: "group",
												"aria-label": "פעילויות מוצעות",
												children: [d.map((t, n) => /* @__PURE__ */ (0, x.jsxs)("button", {
													type: "button",
													disabled: p,
													onClick: () => h || m ? s(e, l, t) : r(e, t.activityKey),
													children: [
														/* @__PURE__ */ (0, x.jsxs)("em", { children: [
															"אפשרות ",
															n + 1,
															n === 0 ? " · הצעת הסוכן המובילה" : ""
														] }),
														/* @__PURE__ */ (0, x.jsx)("span", { children: t.name }),
														/* @__PURE__ */ (0, x.jsxs)("small", { children: [
															"ציון התאמה ",
															t.finalScore,
															" · ",
															t.plannedStart || "?",
															"–",
															t.plannedFinish || "?"
														] })
													]
												}, t.activityKey)), h ? Vt.map((t) => /* @__PURE__ */ (0, x.jsx)("button", {
													type: "button",
													className: "is-reject",
													disabled: p,
													onClick: () => c(e, l, t),
													children: t.labelHe
												}, t.type)) : m ? /* @__PURE__ */ (0, x.jsx)("button", {
													type: "button",
													className: "is-reject",
													disabled: p,
													onClick: () => c(e, l, Vt[0]),
													children: "אף אפשרות אינה מתאימה"
												}) : null]
											})]
										}) : null,
										(l.warnings || []).map((e) => /* @__PURE__ */ (0, x.jsxs)("small", {
											className: "activityAgentWarning",
											children: ["⚠ ", e]
										}, e))
									]
								})
							})
						}) : null] }, `${e.sourceTable}:${e.id}`);
					}), k.length ? null : /* @__PURE__ */ (0, x.jsx)("tr", { children: /* @__PURE__ */ (0, x.jsx)("td", {
						colSpan: 6,
						className: "schedEmpty",
						children: "אין פריטים התואמים למסננים שנבחרו"
					}) })] })]
				})
			}),
			C < k.length ? /* @__PURE__ */ (0, x.jsx)("button", {
				type: "button",
				className: "activityUpdatesMore",
				onClick: () => w((e) => e + 100),
				children: "טען עוד 100"
			}) : null
		]
	});
}
var dn = ({ indicator: e, onClose: t }) => {
	if (!e) return null;
	let n = e.timing ?? {}, r = e.variances ?? {};
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		className: "schedDetail",
		children: [
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "schedDetailHead",
				children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [
					/* @__PURE__ */ (0, x.jsx)(tn, { status: e.status }),
					/* @__PURE__ */ (0, x.jsx)(nn, { confidence: e.confidence }),
					e.severity != null && /* @__PURE__ */ (0, x.jsxs)("span", {
						className: "schedBadge schedSeverity",
						children: ["חומרה ", e.severity]
					})
				] }), /* @__PURE__ */ (0, x.jsx)("button", {
					type: "button",
					className: "schedClose",
					onClick: t,
					children: "✕"
				})]
			}),
			/* @__PURE__ */ (0, x.jsx)("h3", {
				className: "schedDetailTitle",
				children: e.subject?.name
			}),
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "schedDetailMeta",
				children: [
					$t(e.lateness),
					" · ",
					en(e.lateness)
				]
			}),
			/* @__PURE__ */ (0, x.jsx)("p", {
				className: "schedExplanation",
				children: e.explanation
			}),
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "schedTimingGrid",
				children: [
					/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "התחלה מתוכננת" }), /* @__PURE__ */ (0, x.jsx)("b", { children: n.plannedStart ?? "—" })] }),
					/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "סיום מתוכנן" }), /* @__PURE__ */ (0, x.jsx)("b", { children: n.plannedFinish ?? "—" })] }),
					/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "סיום חוזי" }), /* @__PURE__ */ (0, x.jsx)("b", { children: n.contractFinish ?? "—" })] }),
					/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "תחזית סיום" }), /* @__PURE__ */ (0, x.jsx)("b", { children: n.forecastFinish ?? "—" })] }),
					/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "סיום בפועל" }), /* @__PURE__ */ (0, x.jsx)("b", { children: n.observedFinish ?? "—" })] }),
					/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "% ביצוע" }), /* @__PURE__ */ (0, x.jsx)("b", { children: n.percentComplete ?? "—" })] }),
					/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "סטייה מגרסה קודמת" }), /* @__PURE__ */ (0, x.jsx)("b", { children: r.contractorVersionSlippageDays == null ? "—" : `${r.contractorVersionSlippageDays} ימים` })] }),
					/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "Float נותר" }), /* @__PURE__ */ (0, x.jsx)("b", { children: r.remainingFloatDays == null ? "— (אין נתוני תלויות)" : `${r.remainingFloatDays} ימים` })] })
				]
			}),
			/* @__PURE__ */ (0, x.jsx)(rn, { gates: e.gates }),
			e.evidence?.length ? /* @__PURE__ */ (0, x.jsxs)("div", {
				className: "schedEvidence",
				children: [/* @__PURE__ */ (0, x.jsx)("div", {
					className: "schedGatesTitle",
					children: "ראיות:"
				}), e.evidence.map((e) => /* @__PURE__ */ (0, x.jsxs)("div", {
					className: "schedEvidenceRow",
					children: [
						/* @__PURE__ */ (0, x.jsx)("span", {
							className: "schedEvidenceKind",
							children: e.kind
						}),
						/* @__PURE__ */ (0, x.jsx)("span", { children: e.excerpt }),
						e.eventDate ? /* @__PURE__ */ (0, x.jsx)("span", {
							className: "schedEvidenceDate",
							children: e.eventDate
						}) : null
					]
				}, e.evidenceId))]
			}) : null
		]
	});
}, fn = {
	execution: "ביצוע",
	payment: "תשלומים",
	notice: "הודעות",
	guarantee: "ערבויות",
	insurance: "ביטוחים",
	warranty: "בדק ואחריות",
	other: "אחר"
}, pn = {
	hours: "שעות",
	working_days: "ימי עבודה",
	calendar_days: "ימים",
	weeks: "שבועות",
	months: "חודשים"
}, mn = {
	event: "אירוע נכנס",
	schedule_task: "נקודה בלוח הקבלן",
	milestone: "אבן דרך אחרת",
	unspecified: "לא הוגדר"
};
function hn(e) {
	if (e.offset_value == null) return "ללא כימות";
	let t = pn[e.offset_unit] ?? e.offset_unit ?? "";
	return `${Number(e.offset_value)} ${t}`.trim();
}
function gn(e) {
	let t = e?.metadata?.contracts_workspace_id, n = e?.source_contract_decision_id;
	if (!t || !n) return null;
	let r = new URLSearchParams({ decisionId: n });
	return e.source_page && r.set("page", String(e.source_page)), `/api/contracts/workspaces/${encodeURIComponent(t)}/source-link?${r}`;
}
var _n = ({ data: e, expanded: t, onToggle: n, resolvingId: r, onResolve: i, onManualResolve: a, manualDates: o, onManualDateChange: s, rowResults: c }) => {
	let l = e?.conditions ?? [], u = Object.entries(l.reduce((e, t) => ((e[t.category] ||= []).push(t), e), {}));
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		className: "condBox",
		children: [/* @__PURE__ */ (0, x.jsxs)("button", {
			type: "button",
			className: "condHead",
			onClick: n,
			"aria-expanded": t,
			"aria-controls": "schedule-conditions-body",
			children: [
				/* @__PURE__ */ (0, x.jsxs)("span", {
					className: "condHeadTitle",
					children: ["⏳ פנקס זמנים יחסיים מהחוזה", /* @__PURE__ */ (0, x.jsx)("span", {
						className: "condHeadCount",
						children: l.length
					})]
				}),
				/* @__PURE__ */ (0, x.jsx)("span", {
					className: "condHeadHint",
					children: "כל נקודת זמן שנמשכה מהחוזה, הפעולה שמפעילה אותה והתאריך שנקלט בפועל"
				}),
				/* @__PURE__ */ (0, x.jsx)("span", {
					className: "condChevron",
					children: t ? "▲" : "▼"
				})
			]
		}), t ? /* @__PURE__ */ (0, x.jsxs)("div", {
			id: "schedule-conditions-body",
			className: "condBody",
			children: [/* @__PURE__ */ (0, x.jsx)("div", {
				className: "condResolverBar",
				children: /* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("strong", { children: "אותו שדה — הזנה ידנית היום, השלמה אוטומטית בהמשך" }), /* @__PURE__ */ (0, x.jsx)("span", { children: "בחירת תאריך מפעילה את מנוע הלו״ז הדטרמיניסטי. איתור אוטומטי מחפש את אותו אירוע ב־Gantt, באירועים מזוהים ורק אז ב־RAG." })] })
			}), u.length ? u.map(([e, t]) => /* @__PURE__ */ (0, x.jsxs)("div", {
				className: "condGroup",
				children: [/* @__PURE__ */ (0, x.jsxs)("div", {
					className: "condGroupTitle",
					children: [fn[e] ?? e, /* @__PURE__ */ (0, x.jsx)("span", {
						className: "condGroupCount",
						children: t.length
					})]
				}), /* @__PURE__ */ (0, x.jsx)("div", {
					className: "condTableWrap",
					children: /* @__PURE__ */ (0, x.jsxs)("table", {
						className: "condTable",
						children: [/* @__PURE__ */ (0, x.jsx)("thead", { children: /* @__PURE__ */ (0, x.jsxs)("tr", { children: [
							/* @__PURE__ */ (0, x.jsx)("th", { children: "ההתחייבות החוזית והזמן" }),
							/* @__PURE__ */ (0, x.jsx)("th", { children: "האירוע שמפעיל את הספירה" }),
							/* @__PURE__ */ (0, x.jsx)("th", { children: "תאריך האירוע בפועל" })
						] }) }), /* @__PURE__ */ (0, x.jsx)("tbody", { children: t.map((e) => {
							let t = c?.[e.id], n = r === e.id, l = gn(e), u = e.metadata?.pending_reason, d = o && Object.prototype.hasOwnProperty.call(o, e.id) ? o[e.id] : yt(e.trigger_event_date ?? ""), f = vt(d), p = !!d && !f, m = e.status === "resolved";
							return /* @__PURE__ */ (0, x.jsxs)("tr", {
								className: m ? "is-resolved" : "",
								title: e.source_excerpt,
								children: [
									/* @__PURE__ */ (0, x.jsxs)("td", {
										className: "condContractPoint",
										children: [
											/* @__PURE__ */ (0, x.jsxs)("div", {
												className: "condOffsetLine",
												children: [/* @__PURE__ */ (0, x.jsx)("b", { children: hn(e) }), /* @__PURE__ */ (0, x.jsx)("span", {
													className: `condState is-${e.status}`,
													children: m ? "הושלם" : "ממתין"
												})]
											}),
											/* @__PURE__ */ (0, x.jsx)("strong", {
												className: "condName",
												children: e.name
											}),
											e.metadata?.action_description_he ? /* @__PURE__ */ (0, x.jsxs)("span", {
												className: "condActionDescription",
												children: [
													/* @__PURE__ */ (0, x.jsx)("b", { children: "מה החוזה מחייב:" }),
													" ",
													e.metadata.action_description_he
												]
											}) : null,
											/* @__PURE__ */ (0, x.jsx)("span", {
												className: "condPage",
												children: l ? /* @__PURE__ */ (0, x.jsxs)("a", {
													href: l,
													target: "_blank",
													rel: "noreferrer",
													title: "פתיחת מסמך החוזה בקישור מאובטח קצר־חיים",
													children: [e.metadata?.source_filename || "מסמך החוזה", e.source_page ? ` · עמ׳ ${e.source_page}` : ""]
												}) : e.source_page ? `עמ׳ ${e.source_page}` : "מקור חוזי"
											})
										]
									}),
									/* @__PURE__ */ (0, x.jsxs)("td", {
										className: "condTriggerCell",
										children: [
											/* @__PURE__ */ (0, x.jsx)("strong", { children: e.anchor_description || "האירוע המפעיל טרם תואר" }),
											/* @__PURE__ */ (0, x.jsx)("span", {
												className: `condAnchor is-${e.anchor_kind}`,
												children: mn[e.anchor_kind] ?? e.anchor_kind
											}),
											u ? /* @__PURE__ */ (0, x.jsx)("span", {
												className: "condPendingReason",
												children: u
											}) : null,
											e.source_excerpt ? /* @__PURE__ */ (0, x.jsxs)("details", {
												className: "condSourceExcerpt",
												children: [/* @__PURE__ */ (0, x.jsx)("summary", { children: "הצג ציטוט מהחוזה" }), /* @__PURE__ */ (0, x.jsx)("p", { children: e.source_excerpt })]
											}) : null
										]
									}),
									/* @__PURE__ */ (0, x.jsxs)("td", {
										className: "condDateCell",
										children: [
											/* @__PURE__ */ (0, x.jsxs)("div", {
												className: "condDateEntry",
												children: [/* @__PURE__ */ (0, x.jsx)("input", {
													type: "text",
													inputMode: "numeric",
													dir: "ltr",
													lang: "he-IL",
													placeholder: "dd/mm/yyyy",
													pattern: "[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}",
													value: d,
													disabled: m || !!r,
													"aria-label": `תאריך האירוע בפועל עבור ${e.name}`,
													"aria-invalid": p,
													"aria-describedby": `condition-date-hint-${e.id}`,
													onChange: (t) => s(e.id, t.target.value),
													onBlur: () => {
														f && s(e.id, yt(f));
													}
												}), m ? /* @__PURE__ */ (0, x.jsx)("span", {
													className: "condVerifiedDate",
													children: "תאריך מאומת"
												}) : /* @__PURE__ */ (0, x.jsx)("button", {
													type: "button",
													className: "condManualBtn",
													onClick: () => a(e, f),
													disabled: !f || !!r,
													children: n ? "שומר…" : "שמור וחשב מועד"
												})]
											}),
											/* @__PURE__ */ (0, x.jsx)("span", {
												id: `condition-date-hint-${e.id}`,
												className: `condDateHint ${p ? "is-error" : ""}`,
												children: p ? "יש להזין תאריך תקין בפורמט יום/חודש/שנה" : "פורמט: יום/חודש/שנה"
											}),
											m ? null : /* @__PURE__ */ (0, x.jsx)("button", {
												type: "button",
												className: "condResolveBtn",
												onClick: () => i(e),
												disabled: !!r,
												children: n ? "מנוע הלו״ז מחפש…" : "איתור אוטומטי במנוע הלו״ז"
											}),
											t ? /* @__PURE__ */ (0, x.jsxs)("span", {
												className: `condRowResult is-${t.status}`,
												title: t.reason || t.evidence?.reason || "",
												children: [t.status === "not_found" ? "לא נמצא תאריך" : t.status === "needs_review" ? t.provisionalDueDate ? `מועד משוער: ${yt(t.provisionalDueDate)}` : "נדרשת בדיקה" : t.status === "error" ? t.reason || "החיפוש נכשל" : yt(t.dueDate) || "הושלם", t.errorCode === "openrouter_auth" ? /* @__PURE__ */ (0, x.jsx)("a", {
													className: "condSettingsLink",
													href: "#settings",
													children: "עדכון מפתח בהגדרות"
												}) : null]
											}) : null
										]
									})
								]
							}, e.id);
						}) })]
					})
				})]
			}, e)) : /* @__PURE__ */ (0, x.jsxs)("div", {
				className: "condEmptyState",
				children: [/* @__PURE__ */ (0, x.jsx)("span", {
					className: "condEmptyIcon",
					children: "⌛"
				}), /* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("strong", { children: "התנאים היחסיים טרם סונכרנו למאגר הלו״ז" }), /* @__PURE__ */ (0, x.jsx)("span", { children: "לאחר הפעלת חיבור Indicator הם יופיעו כאן אוטומטית, ללא חילוץ חוזר של החוזה." })] })]
			})]
		}) : null]
	});
}, vn = ({ alerts: e, expanded: t, onToggle: n }) => {
	let r = e.reduce((e, t) => Math.max(e, Number(t.severity_level) || 0), 0);
	return /* @__PURE__ */ (0, x.jsxs)("section", {
		className: "schedAlertsBox",
		"aria-label": "חריגות והתראות פעילות",
		children: [/* @__PURE__ */ (0, x.jsxs)("button", {
			type: "button",
			className: "schedAlertsHead",
			onClick: n,
			"aria-expanded": t,
			"aria-controls": "schedule-alerts-body",
			children: [
				/* @__PURE__ */ (0, x.jsxs)("span", {
					className: "schedAlertsHeadTitle",
					children: ["חריגות והתראות פעילות", /* @__PURE__ */ (0, x.jsx)("span", {
						className: "schedAlertsCount",
						children: e.length
					})]
				}),
				/* @__PURE__ */ (0, x.jsx)("span", {
					className: "schedAlertsHeadHint",
					children: r ? `החומרה הגבוהה ביותר: ${r}` : "אין חומרה פעילה"
				}),
				/* @__PURE__ */ (0, x.jsx)("span", {
					className: "schedAlertsChevron",
					"aria-hidden": "true",
					children: t ? "▲" : "▼"
				})
			]
		}), t ? /* @__PURE__ */ (0, x.jsx)("div", {
			id: "schedule-alerts-body",
			className: "schedAlerts",
			children: e.map((e) => /* @__PURE__ */ (0, x.jsxs)("article", {
				className: "schedAlertRow",
				children: [
					/* @__PURE__ */ (0, x.jsxs)("span", {
						className: "schedBadge schedSeverity",
						children: ["חומרה ", e.severity_level]
					}),
					/* @__PURE__ */ (0, x.jsx)("b", { children: e.title }),
					/* @__PURE__ */ (0, x.jsx)("span", {
						className: "schedAlertDesc",
						children: e.description
					})
				]
			}, e.id))
		}) : null]
	});
}, yn = ({ health: e }) => {
	if (!e) return null;
	let t = e.schedule?.ageDays;
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		className: "schedHealth",
		children: [
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "schedCard",
				children: [/* @__PURE__ */ (0, x.jsxs)("div", {
					className: "schedCardValue",
					children: [
						e.late,
						" ",
						/* @__PURE__ */ (0, x.jsxs)("span", {
							className: "schedCardOf",
							children: ["מתוך ", e.computed]
						})
					]
				}), /* @__PURE__ */ (0, x.jsx)("div", {
					className: "schedCardLabel",
					children: "פעילויות באיחור"
				})]
			}),
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "schedCard",
				children: [/* @__PURE__ */ (0, x.jsx)("div", {
					className: "schedCardValue",
					children: e.totalDaysLate?.toLocaleString?.() ?? e.totalDaysLate
				}), /* @__PURE__ */ (0, x.jsx)("div", {
					className: "schedCardLabel",
					children: "סה\"כ ימי איחור"
				})]
			}),
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "schedCard",
				children: [/* @__PURE__ */ (0, x.jsx)("div", {
					className: "schedCardValue",
					children: e.worst ? `${e.worst.daysLate} ימים` : "—"
				}), /* @__PURE__ */ (0, x.jsxs)("div", {
					className: "schedCardLabel",
					title: e.worst?.name,
					children: ["החריגה הגדולה: ", e.worst?.name ?? "—"]
				})]
			}),
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "schedCard",
				children: [/* @__PURE__ */ (0, x.jsx)("div", {
					className: "schedCardValue",
					children: e.milestonesDelayed
				}), /* @__PURE__ */ (0, x.jsx)("div", {
					className: "schedCardLabel",
					children: "אבני דרך באיחור"
				})]
			}),
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: `schedCard ${t != null && t > 90 ? "schedCardAlarm" : ""}`,
				children: [/* @__PURE__ */ (0, x.jsxs)("div", {
					className: "schedCardValue",
					children: [t ?? "—", " ימים"]
				}), /* @__PURE__ */ (0, x.jsxs)("div", {
					className: "schedCardLabel",
					children: [
						"גיל הלוח (",
						e.schedule?.relevancyDate ?? "—",
						")",
						t != null && t > 90 ? " — לוח מיושן, הביטחון מופחת" : ""
					]
				})]
			})
		]
	});
};
function bn() {
	let [e, t] = (0, b.useState)([]), [n, r] = (0, b.useState)(""), [i, a] = (0, b.useState)(""), [o, s] = (0, b.useState)(""), [c, l] = (0, b.useState)(!1), [u, d] = (0, b.useState)(""), [f, p] = (0, b.useState)(null), [m, h] = (0, b.useState)(null), [g, _] = (0, b.useState)([]), [v, y] = (0, b.useState)({
		total: 0,
		items: []
	}), [S, C] = (0, b.useState)(null), [w, T] = (0, b.useState)(null), [E, D] = (0, b.useState)({}), [O, k] = (0, b.useState)(null), [A, j] = (0, b.useState)(() => At()), [M, N] = (0, b.useState)(!1), [ee, P] = (0, b.useState)(wt), F = (0, b.useRef)({
		token: 0,
		stopRequested: !1,
		active: !1
	}), [I, te] = (0, b.useState)(null), [L, ne] = (0, b.useState)(null), [re, ie] = (0, b.useState)(gt.conditionsOpen), [R, ae] = (0, b.useState)(gt.alertsOpen), [oe, se] = (0, b.useState)(null), [ce, le] = (0, b.useState)({}), [ue, de] = (0, b.useState)(""), [fe, pe] = (0, b.useState)({}), [me, he] = (0, b.useState)(gt.view), [ge, _e] = (0, b.useState)(gt.onlyLate), [ve, ye] = (0, b.useState)(""), [be, xe] = (0, b.useState)(gt.showLateLines), [Se, Ce] = (0, b.useState)(gt.showAsOfMarker), [we, z] = (0, b.useState)(null), [Te, Ee] = (0, b.useState)(!1), [De, Oe] = (0, b.useState)(!1), [ke, Ae] = (0, b.useState)(""), [je, Me] = (0, b.useState)([]), Ne = (0, b.useCallback)(async () => {
		let e = await Zt("/api/schedule/projects", { timeoutMs: 45e3 });
		return t(e.projects ?? []), e.projects ?? [];
	}, []), B = (0, b.useCallback)(async (e, t, n = "") => {
		if (e) {
			F.current.token += 1, F.current.stopRequested = !1, F.current.active = !1, j(At()), Ee(!0), Ae(""), D({}), k(null);
			try {
				let r = t || n || "", i = r ? `&asOf=${encodeURIComponent(r)}` : "", a = async (e, t, n) => {
					try {
						return {
							value: await e,
							warning: "",
							error: null,
							label: n
						};
					} catch (e) {
						return {
							value: t,
							warning: `${n}: ${e.message}`,
							error: e,
							label: n
						};
					}
				}, [o, s, c, l, u, d, f] = await Promise.all([
					a(Zt(`/api/schedule/health?projectId=${encodeURIComponent(e)}${i}`, { timeoutMs: 45e3 }), null, "טעינת מדדי מצב"),
					a(Zt("/api/schedule/sweep", {
						method: "POST",
						body: {
							projectId: e,
							asOf: r || null,
							persist: !1,
							filters: { excludeCompleted: !1 }
						},
						timeoutMs: 45e3
					}), {
						indicators: [],
						warnings: []
					}, "חישוב לוח הזמנים"),
					a(Zt(`/api/schedule/alerts?projectId=${encodeURIComponent(e)}&baselined=false&lifecycle=open,updated`, { timeoutMs: 45e3 }), { alerts: [] }, "טעינת התראות"),
					a(Zt(`/api/schedule/alerts?projectId=${encodeURIComponent(e)}&baselined=true`, { timeoutMs: 45e3 }), { count: 0 }, "טעינת היסטוריית התראות"),
					a(Zt(`/api/schedule/conditions?projectId=${encodeURIComponent(e)}&status=pending,resolved`, { timeoutMs: 45e3 }), { conditions: [] }, "טעינת אבני דרך חוזיות"),
					a(Zt(`/api/schedule/activity-updates?projectId=${encodeURIComponent(e)}`, { timeoutMs: 45e3 }), {
						total: 0,
						items: []
					}, "טעינת עדכונים והתראות"),
					a(Zt(`/api/schedule/activity-updates/assignment-agent/reviews?projectId=${encodeURIComponent(e)}&status=pending`, { cache: "no-store" }), { reviews: [] }, "טעינת החלטות צוות")
				]), m = o.value, g = s.value, v = c.value, b = l.value, x = u.value, S = d.value, C = f.value;
				k(C.labelCoverage || null);
				let w = [o, s].filter((e) => e.error);
				w.length && Ae(Qt(w)), p(m), h(g), _(v.alerts ?? []), te(b.count ?? 0), ne(x);
				let T = Wt(S.items, C.reviews);
				y({
					total: T.items.length,
					items: T.items
				}), D(T.agentResults), Me([...new Set([
					...m?.warnings ?? [],
					...g.warnings ?? [],
					o.warning,
					s.warning,
					c.warning,
					l.warning,
					u.warning,
					d.warning,
					f.warning
				].filter(Boolean))]);
			} catch (e) {
				Ae(e.message);
			} finally {
				Ee(!1);
			}
		}
	}, []), Pe = (0, b.useCallback)(async () => {
		if (n) {
			l(!0), d(""), Ae("");
			try {
				let e = (await Zt("/api/schedule/project-end-date", {
					method: "POST",
					body: {
						projectId: n,
						projectEndDate: o || null
					}
				})).projectEndDate || "";
				t((t) => t.map((t) => t.projectId === n ? {
					...t,
					projectEndDate: e || null
				} : t)), d(e ? `תאריך סיום הפרויקט נשמר: ${e}` : "תאריך סיום הפרויקט נוקה; הפרויקט מוגדר כפעיל."), await B(n, i, e);
			} catch (e) {
				Ae(e.message);
			} finally {
				l(!1);
			}
		}
	}, [
		n,
		o,
		i,
		B
	]), Fe = (0, b.useCallback)(async (e, t) => {
		if (!(!n || !e?.id)) {
			C(e.id), Ae("");
			try {
				let r = await Zt("/api/schedule/activity-updates/assign", {
					method: "POST",
					body: {
						projectId: n,
						sourceId: e.id,
						activityKey: t
					}
				});
				y((t) => ({
					...t,
					items: t.items.map((t) => t.id === e.id ? r.item : t)
				})), r.reviewQueueWarning && Me((e) => [.../* @__PURE__ */ new Set([...e, `סנכרון החלטת צוות: ${r.reviewQueueWarning}`])]), D((t) => {
					if (!t[e.id]) return t;
					let n = { ...t };
					return delete n[e.id], n;
				});
			} catch (e) {
				Ae(e.message);
			} finally {
				C(null);
			}
		}
	}, [n]), Ie = (0, b.useCallback)(async (e, { timeFilter: t = !1, reviewOnly: r = !1 } = {}) => {
		if (!n || !e?.id) return {
			ok: !1,
			error: "חסרים פרויקט או מזהה התראה"
		};
		T(e.id), Ae(""), D((t) => ({
			...t,
			[e.id]: null
		}));
		try {
			let i = await Zt("/api/schedule/activity-updates/assignment-agent/run", {
				method: "POST",
				body: {
					projectId: n,
					sourceId: e.id,
					...t ? { timeFilter: !0 } : {},
					...r ? { reviewOnly: !0 } : {}
				},
				timeoutMs: 9e5
			});
			return D((t) => ({
				...t,
				[e.id]: i
			})), i.workflowLog && typeof window.__bidocSetWorkflowFromReact == "function" && window.__bidocSetWorkflowFromReact(i), i.assignment && y((t) => ({
				...t,
				items: t.items.map((t) => t.id === e.id ? i.assignment : t)
			})), {
				ok: !0,
				result: i
			};
		} catch (t) {
			return D((n) => ({
				...n,
				[e.id]: { error: t.message }
			})), {
				ok: !1,
				error: t.message
			};
		} finally {
			T(null);
		}
	}, [n]), Le = (0, b.useCallback)(async ({ queue: e, startIndex: t = 0, initialStats: n = null, timeFilter: r = !1 }) => {
		if (F.current.active) return;
		if (!e.length || t >= e.length) {
			j(At({
				status: St.COMPLETED,
				queue: e,
				total: e.length,
				nextIndex: e.length,
				processed: Number(n?.processed) || 0,
				assigned: Number(n?.assigned) || 0,
				review: Number(n?.review) || 0,
				skipped: Number(n?.skipped) || 0,
				failed: Number(n?.failed) || 0
			}));
			return;
		}
		let i = F.current.token + 1;
		F.current = {
			token: i,
			stopRequested: !1,
			active: !0
		};
		let a = {
			processed: Number(n?.processed) || 0,
			assigned: Number(n?.assigned) || 0,
			review: Number(n?.review) || 0,
			skipped: Number(n?.skipped) || 0,
			failed: Number(n?.failed) || 0
		}, o = {
			queue: e,
			total: e.length,
			timeFilter: r === !0
		};
		j(At({
			...o,
			...a,
			status: St.RUNNING,
			nextIndex: t,
			currentId: e[t]?.id || null
		}));
		for (let n = t; n < e.length; n += 1) {
			if (F.current.token !== i) return;
			if (F.current.stopRequested) {
				F.current.active = !1, j(At({
					...o,
					...a,
					status: St.PAUSED,
					nextIndex: n
				}));
				return;
			}
			j(At({
				...o,
				...a,
				status: St.RUNNING,
				nextIndex: n,
				currentId: e[n].id
			}));
			let t = await Ie(e[n], {
				timeFilter: r,
				reviewOnly: !0
			});
			if (F.current.token !== i) return;
			a = Lt(a, t);
			let s = n + 1;
			if (F.current.stopRequested) {
				F.current.active = !1, j(At({
					...o,
					...a,
					status: s < e.length ? St.PAUSED : St.COMPLETED,
					nextIndex: s
				}));
				return;
			}
			s >= e.length && (F.current.active = !1), j(At({
				...o,
				...a,
				status: s >= e.length ? St.COMPLETED : St.RUNNING,
				nextIndex: s,
				currentId: s < e.length ? e[s].id : null
			}));
		}
	}, [Ie]), Re = (0, b.useCallback)((e) => {
		let t = new Set(e.map((e) => String(e.id)));
		D((e) => Object.fromEntries(Object.entries(e).filter(([e]) => !t.has(String(e)))));
	}, []), ze = (0, b.useCallback)((e = v.items, t = ee) => {
		let n = Mt(e), r = Mt(e, { limit: jt(t) });
		if (!r.length) return;
		let i = Nt({
			batchSize: r.length,
			eligibleCount: n.length
		});
		typeof window < "u" && !window.confirm(i) || (Re(r), Le({
			queue: r,
			timeFilter: M
		}));
	}, [
		v.items,
		ee,
		M,
		Re,
		Le
	]), Be = (0, b.useCallback)(() => {
		A.status === St.RUNNING && (F.current.stopRequested = !0, j((e) => ({
			...e,
			status: St.STOPPING
		})));
	}, [A.status]), Ve = (0, b.useCallback)(() => {
		A.status === St.PAUSED && Le({
			queue: A.queue,
			startIndex: A.nextIndex,
			initialStats: A,
			timeFilter: A.timeFilter
		});
	}, [A, Le]), He = (0, b.useCallback)((e = v.items, t = ee) => {
		ze(e, t);
	}, [
		v.items,
		ee,
		ze
	]), V = (0, b.useCallback)(async (e, t, r) => {
		if (!(!n || !t?.runId || !r?.activityKey)) {
			T(e.id), Ae("");
			try {
				let i = !!(t.persistedReview && t.detachedFromCurrentFeed), a = await Zt(i ? "/api/schedule/activity-updates/assignment-agent/review-label" : "/api/schedule/activity-updates/assignment-agent/confirm", {
					method: "POST",
					body: {
						projectId: n,
						runId: t.runId,
						sourceId: e.id,
						activityKey: r.activityKey,
						labelType: "confirmed_match",
						reason: "הבודק אישר את הפעילות המוצעת כתווית כיול."
					}
				});
				i || y((t) => ({
					...t,
					items: t.items.map((t) => t.id === e.id ? a.item : t)
				})), a.reviewQueueWarning && Me((e) => [.../* @__PURE__ */ new Set([...e, `סנכרון החלטת צוות: ${a.reviewQueueWarning}`])]), D((n) => ({
					...n,
					[e.id]: {
						...t,
						auditPersisted: !1,
						decision: {
							...t.decision,
							autoAssigned: !1,
							selectedActivityName: r.name,
							rankingScore: r.finalScore,
							calibratedProbability: null,
							calibration: {
								status: "not_applicable",
								probability: null,
								artifactId: null,
								reason: "manual_review"
							},
							confidence: r.finalScore,
							reason: "הצעת הסוכן אושרה ונשמרה."
						},
						approved: !0
					}
				}));
			} catch (n) {
				D((r) => ({
					...r,
					[e.id]: {
						...t,
						error: n.message
					}
				}));
			} finally {
				T(null);
			}
		}
	}, [n]), Ue = (0, b.useCallback)(async (e, t, r = Vt[0]) => {
		if (!(!n || !t?.runId)) {
			T(e.id), Ae("");
			try {
				let i = await Zt(t.auditPersisted && !t.detachedFromCurrentFeed ? "/api/schedule/activity-updates/assignment-agent/reject" : "/api/schedule/activity-updates/assignment-agent/review-label", {
					method: "POST",
					body: {
						projectId: n,
						runId: t.runId,
						sourceId: e.id,
						labelType: r.type,
						reason: r.reasonHe
					}
				});
				i.reviewQueueWarning && Me((e) => [.../* @__PURE__ */ new Set([...e, `סנכרון החלטת צוות: ${i.reviewQueueWarning}`])]), D((n) => ({
					...n,
					[e.id]: {
						...t,
						auditPersisted: !1,
						decision: {
							...t.decision,
							reason: r.reasonHe
						},
						evaluationLabelType: r.type,
						rejected: !0
					}
				}));
			} catch (n) {
				D((r) => ({
					...r,
					[e.id]: {
						...t,
						error: n.message
					}
				}));
			} finally {
				T(null);
			}
		}
	}, [n]), We = (0, b.useCallback)(async () => {
		if (n) {
			Oe(!0), Ae("");
			try {
				await Zt("/api/schedule/alert-scan", {
					method: "POST",
					body: {
						projectId: n,
						asOf: i || o || null
					},
					timeoutMs: 24e4
				}), await B(n, i, o);
			} catch (e) {
				Ae(e.message);
			} finally {
				Oe(!1);
			}
		}
	}, [
		n,
		i,
		o,
		B
	]), Ge = (0, b.useCallback)(async (e, t = null) => {
		if (!(!n || !e?.id)) {
			se(e.id), Ae(""), de("");
			try {
				let r = (await Zt("/api/schedule/conditions/resolve", {
					method: "POST",
					body: {
						projectId: n,
						conditionId: e.id,
						commit: !0,
						minConfidence: .8,
						...t ? { manualTriggerDate: t } : {}
					},
					timeoutMs: 9e5
				})).results?.[0] ?? {
					status: "error",
					reason: "הסוכן לא החזיר תוצאה"
				};
				if (le((t) => ({
					...t,
					[e.id]: r
				})), r.status === "resolved") de(`הושלם: ${e.name} — האירוע ${r.evidence?.triggerDate || t || "אותר"}, והמועד החוזי ${r.dueDate} נשמר.`), await B(n, i, o);
				else if (r.triggerSaved) {
					let e = r.provisionalDueDate ? ` מועד משוער ${r.provisionalDueDate} סומן בדגלון כתום על הציר.` : "";
					de(`תאריך האירוע ${r.evidence?.triggerDate || t} נשמר.${e} המועד החוזי הסופי ממתין להשלמת לוח ימי העבודה והחגים.`), await B(n, i, o);
				}
			} catch (t) {
				le((n) => ({
					...n,
					[e.id]: {
						status: "error",
						reason: t.message
					}
				})), Ae(t.message);
			} finally {
				se(null);
			}
		}
	}, [
		n,
		i,
		o,
		B
	]);
	(0, b.useEffect)(() => {
		let e = !1;
		return Ne().then((t) => {
			e || !t.length || (r((e) => e || t[0].projectId), s((e) => e || t[0].projectEndDate || ""));
		}).catch((e) => Ae(e.message)), () => {
			e = !0;
		};
	}, [Ne]), (0, b.useEffect)(() => () => {
		F.current.token += 1, F.current.stopRequested = !0, F.current.active = !1;
	}, []), (0, b.useEffect)(() => {
		if (!n) return;
		location.hash === "#schedule" && B(n, i, o);
		let e = () => B(n, i, o);
		return window.addEventListener("bidoc:schedule-activated", e), () => window.removeEventListener("bidoc:schedule-activated", e);
	}, [
		n,
		i,
		o,
		B
	]);
	let Ke = (0, b.useMemo)(() => [...(m?.indicators ?? []).filter((e) => !(ge && e.lateness?.isLate !== !0 || ve && !(e.lateness?.daysLate >= Number(ve))))].sort((e, t) => Number(t.subject.kind === "milestone") - Number(e.subject.kind === "milestone")), [
		m,
		ge,
		ve
	]), qe = m?.scheduleMeta, Je = (0, b.useMemo)(() => {
		let e = (e) => {
			let t = String(e || "").match(/^(\d{4})-(\d{2})-(\d{2})$/u);
			return t ? `${t[3]}.${t[2]}.${t[1].slice(2)}` : "ללא תאריך";
		}, t = /* @__PURE__ */ new Map();
		for (let n of m?.indicators ?? []) {
			let r = n.subject?.activityKey;
			if (r && !t.has(r)) {
				let i = n.timing?.plannedStart, a = n.timing?.plannedFinish;
				t.set(r, {
					key: r,
					name: n.subject?.name || r,
					start: i || "",
					dateLabel: i || a ? `${e(i)}–${e(a)}` : "ללא תאריכי תכנון"
				});
			}
		}
		return [...t.values()].sort((e, t) => e.name.localeCompare(t.name, "he") || e.start.localeCompare(t.start));
	}, [m]), Ye = (0, b.useMemo)(() => {
		let e = m?.indicators ?? [];
		if (!e.length) return null;
		let t = {
			ok: 2,
			stale: 1,
			missing: 0
		}, n = {};
		for (let r of Object.keys(Jt)) r === "scheduleVersions" ? n[r] = Math.max(...e.map((e) => Number(e.gates?.scheduleVersions) || 0)) : n[r] = e.reduce((e, n) => (t[n.gates?.[r]] ?? 0) > (t[e] ?? 0) ? n.gates[r] : e, "missing");
		return n;
	}, [m]);
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		className: "schedulePage",
		dir: "rtl",
		children: [
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "schedToolbar",
				children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("h2", {
					className: "schedTitle",
					children: "לוח זמנים — שלושת הצירים"
				}), qe ? /* @__PURE__ */ (0, x.jsxs)("div", {
					className: "schedSubtitle",
					children: [
						"נכון ל-",
						/* @__PURE__ */ (0, x.jsx)("b", { children: m.asOf }),
						" · מקור: ",
						/* @__PURE__ */ (0, x.jsx)("b", { children: qe.displayName ?? qe.sourceVersionId }),
						" (Data Date: ",
						qe.relevancyDate ?? "?",
						") · ",
						qe.versionCount,
						" ",
						qe.versionCount === 1 ? "גרסה" : "גרסאות"
					]
				}) : null] }), /* @__PURE__ */ (0, x.jsxs)("div", {
					className: "schedControls",
					children: [
						/* @__PURE__ */ (0, x.jsxs)("select", {
							value: n,
							"aria-label": "בחירת פרויקט",
							onChange: (t) => {
								let n = t.target.value;
								r(n), s(e.find((e) => e.projectId === n)?.projectEndDate || ""), d("");
							},
							className: "schedSelect",
							children: [!e.length && /* @__PURE__ */ (0, x.jsx)("option", {
								value: "",
								children: "אין לוחות זמנים"
							}), e.map((e) => /* @__PURE__ */ (0, x.jsxs)("option", {
								value: e.projectId,
								children: [
									e.name || `${e.projectId.slice(0, 8)}…`,
									" (",
									e.files,
									" קבצים, עדכני ל-",
									e.latestRelevancyDate ?? "?",
									")"
								]
							}, e.projectId))]
						}),
						/* @__PURE__ */ (0, x.jsxs)("label", {
							className: "schedDateField",
							htmlFor: "schedule-as-of",
							children: ["נכון ל־", /* @__PURE__ */ (0, x.jsx)("input", {
								id: "schedule-as-of",
								type: "date",
								value: i,
								onChange: (e) => a(e.target.value),
								className: "schedDate",
								title: "ריק = תאריך סיום הפרויקט, או היום בפרויקט פעיל"
							})]
						}),
						/* @__PURE__ */ (0, x.jsx)("button", {
							type: "button",
							className: "schedBtn",
							onClick: () => B(n, i, o),
							disabled: Te || !n,
							children: Te ? "טוען…" : "רענן"
						}),
						/* @__PURE__ */ (0, x.jsx)("button", {
							type: "button",
							className: "schedBtn schedBtnPrimary",
							onClick: We,
							disabled: De || !n,
							title: "סריקה מלאה: חישוב אינדיקטורים, שמירת Snapshots ועדכון התראות",
							children: De ? "סורק…" : "סריקת התראות"
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "schedProjectEndControl",
				children: [
					/* @__PURE__ */ (0, x.jsx)("label", {
						htmlFor: "schedule-project-end",
						children: "תאריך סיום הפרויקט"
					}),
					/* @__PURE__ */ (0, x.jsx)("input", {
						id: "schedule-project-end",
						type: "date",
						value: o,
						onChange: (e) => {
							s(e.target.value), d("");
						},
						disabled: !n || c
					}),
					/* @__PURE__ */ (0, x.jsx)("button", {
						type: "button",
						className: "schedBtn",
						onClick: Pe,
						disabled: !n || c,
						children: c ? "שומר…" : "שמור תאריך סיום"
					}),
					/* @__PURE__ */ (0, x.jsx)("span", { children: "ריק = פרויקט פעיל. התאריך השמור עוצר את חישוב האיחור בפרויקטים שהסתיימו." }),
					u ? /* @__PURE__ */ (0, x.jsx)("strong", {
						role: "status",
						children: u
					}) : null
				]
			}),
			Ye ? /* @__PURE__ */ (0, x.jsx)(rn, {
				gates: Ye,
				compact: !0
			}) : null,
			ke ? /* @__PURE__ */ (0, x.jsxs)("div", {
				className: "schedError",
				role: "alert",
				children: [/* @__PURE__ */ (0, x.jsx)("span", { children: ke }), /* @__PURE__ */ (0, x.jsx)("button", {
					type: "button",
					className: "schedBtn",
					onClick: () => B(n, i, o),
					disabled: Te || !n,
					children: Te ? "מנסה שוב…" : "נסה שוב"
				})]
			}) : null,
			je.length ? /* @__PURE__ */ (0, x.jsx)("div", {
				className: "schedWarnings",
				children: je.map((e) => /* @__PURE__ */ (0, x.jsxs)("div", { children: ["⚠ ", e] }, e))
			}) : null,
			/* @__PURE__ */ (0, x.jsx)(yn, { health: f }),
			g.length ? /* @__PURE__ */ (0, x.jsx)(vn, {
				alerts: g,
				expanded: R,
				onToggle: () => ae((e) => !e)
			}) : null,
			I ? /* @__PURE__ */ (0, x.jsxs)("div", {
				className: "schedBaselinedNote",
				children: [I, " חריגות סומנו baselined באתחול ההיסטורי — גלויות בצירים למטה, ולא ייצרו התראה עד החמרה מהותית."]
			}) : null,
			ue ? /* @__PURE__ */ (0, x.jsx)("div", {
				className: "condResolverResult",
				role: "status",
				children: ue
			}) : null,
			/* @__PURE__ */ (0, x.jsx)(_n, {
				data: L,
				expanded: re,
				onToggle: () => ie((e) => !e),
				resolvingId: oe,
				onResolve: Ge,
				onManualResolve: Ge,
				manualDates: fe,
				onManualDateChange: (e, t) => pe((n) => ({
					...n,
					[e]: t
				})),
				rowResults: ce
			}),
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "schedFilters",
				children: [
					/* @__PURE__ */ (0, x.jsxs)("div", {
						className: "schedViewToggle",
						children: [/* @__PURE__ */ (0, x.jsx)("button", {
							type: "button",
							className: me === "axes" ? "is-active" : "",
							onClick: () => he("axes"),
							children: "צירים"
						}), /* @__PURE__ */ (0, x.jsx)("button", {
							type: "button",
							className: me === "table" ? "is-active" : "",
							onClick: () => he("table"),
							children: "טבלה"
						})]
					}),
					/* @__PURE__ */ (0, x.jsxs)("label", { children: [/* @__PURE__ */ (0, x.jsx)("input", {
						type: "checkbox",
						checked: ge,
						onChange: (e) => _e(e.target.checked)
					}), " רק באיחור"] }),
					/* @__PURE__ */ (0, x.jsx)("button", {
						type: "button",
						className: `schedLateLinesToggle ${be ? "is-active" : ""}`,
						"aria-pressed": be,
						disabled: !Se,
						onClick: () => xe((e) => !e),
						children: be ? "הסתר קווי איחור אדומים" : "הצג קווי איחור אדומים"
					}),
					/* @__PURE__ */ (0, x.jsx)("button", {
						type: "button",
						className: `schedAsOfToggle ${Se ? "is-active" : ""}`,
						"aria-pressed": Se,
						onClick: () => Ce((e) => !e),
						title: "בהסתרה, הציר מצטמצם מהפעילות הראשונה עד הסמן האחרון בלוח הזמנים",
						children: Se ? "הסתר נכון ל־ וצמצם ציר" : "הצג נכון ל־"
					}),
					/* @__PURE__ */ (0, x.jsxs)("label", { children: ["מינימום ימי איחור: ", /* @__PURE__ */ (0, x.jsx)("input", {
						type: "number",
						min: "1",
						value: ve,
						onChange: (e) => ye(e.target.value),
						className: "schedNum"
					})] }),
					/* @__PURE__ */ (0, x.jsxs)("span", {
						className: "schedCount",
						children: [Ke.length, " פעילויות"]
					})
				]
			}),
			me === "axes" ? /* @__PURE__ */ (0, x.jsx)(cn, {
				indicators: Ke,
				allIndicators: m?.indicators,
				pendingConditions: L?.conditions,
				timelineItems: v.items,
				asOf: m?.asOf,
				showLateLines: be,
				showAsOfMarker: Se,
				selected: we,
				onSelect: z
			}) : /* @__PURE__ */ (0, x.jsx)("div", {
				className: "schedTableWrap",
				children: /* @__PURE__ */ (0, x.jsxs)("table", {
					className: "schedTable",
					children: [/* @__PURE__ */ (0, x.jsx)("thead", { children: /* @__PURE__ */ (0, x.jsxs)("tr", { children: [
						/* @__PURE__ */ (0, x.jsx)("th", { children: "פעילות" }),
						/* @__PURE__ */ (0, x.jsx)("th", { children: "סטטוס" }),
						/* @__PURE__ */ (0, x.jsx)("th", { children: "איחור / נותר" }),
						/* @__PURE__ */ (0, x.jsx)("th", { children: "בסיס" }),
						/* @__PURE__ */ (0, x.jsx)("th", { children: "% ביצוע" }),
						/* @__PURE__ */ (0, x.jsx)("th", { children: "ביטחון" }),
						/* @__PURE__ */ (0, x.jsx)("th", { children: "חומרה" })
					] }) }), /* @__PURE__ */ (0, x.jsxs)("tbody", { children: [Ke.map((e) => /* @__PURE__ */ (0, x.jsxs)("tr", {
						onClick: () => z(e),
						className: xt(we) === xt(e) ? "is-selected" : "",
						children: [
							/* @__PURE__ */ (0, x.jsxs)("td", {
								className: "schedName",
								children: [e.subject.name, e.subject.isMilestone ? " ◆" : ""]
							}),
							/* @__PURE__ */ (0, x.jsx)("td", { children: /* @__PURE__ */ (0, x.jsx)(tn, { status: e.status }) }),
							/* @__PURE__ */ (0, x.jsx)("td", { children: $t(e.lateness) }),
							/* @__PURE__ */ (0, x.jsx)("td", {
								className: "schedBasis",
								children: en(e.lateness)
							}),
							/* @__PURE__ */ (0, x.jsx)("td", { children: e.timing?.percentComplete ?? "—" }),
							/* @__PURE__ */ (0, x.jsx)("td", { children: /* @__PURE__ */ (0, x.jsx)(nn, { confidence: e.confidence }) }),
							/* @__PURE__ */ (0, x.jsx)("td", { children: e.severity ?? "—" })
						]
					}, xt(e))), !Ke.length && !Te ? /* @__PURE__ */ (0, x.jsx)("tr", { children: /* @__PURE__ */ (0, x.jsx)("td", {
						colSpan: 7,
						className: "schedEmpty",
						children: "אין פעילויות תואמות לפילטר"
					}) }) : null] })]
				})
			}),
			/* @__PURE__ */ (0, x.jsx)(dn, {
				indicator: we,
				onClose: () => z(null)
			}),
			/* @__PURE__ */ (0, x.jsx)(un, {
				items: v.items,
				activities: Je,
				busyId: S,
				onAssign: Fe,
				agentBusyId: w,
				agentResults: E,
				onRunAgent: Ie,
				onConfirmAgent: V,
				onRejectAgent: Ue,
				agentBatch: A,
				onStartAgentBatch: ze,
				onStopAgentBatch: Be,
				onResumeAgentBatch: Ve,
				onRestartAgentBatch: He,
				timeFilterEnabled: M,
				onTimeFilterChange: N,
				batchLimit: ee,
				onBatchLimitChange: P,
				labelCoverage: O
			})
		]
	});
}
//#endregion
//#region src/contracts/reviewMode.js
var xn = Object.freeze({
	promotion: "promotion",
	reviewOnly: "review_only",
	blocked: "blocked"
});
function Sn(e) {
	if (!e || typeof e != "object") return xn.blocked;
	let t = Array.isArray(e.globalBlockers) ? e.globalBlockers : [], n = Array.isArray(e.candidatePlans) ? e.candidatePlans : [];
	if (t.length || n.length === 0) return xn.blocked;
	if (e.transactionReady === !0) {
		let e = n.some((e) => e?.status === "transaction_ready"), t = n.some((e) => !["transaction_ready", "rejected"].includes(e?.status));
		return e && !t ? xn.promotion : xn.blocked;
	}
	return n.every((e) => e?.status === "rejected") ? xn.reviewOnly : xn.blocked;
}
//#endregion
//#region src/contracts/clausePresentation.js
var Cn = "contracts-clause-presentation.r3.3.v1", wn = "contracts-relationships-input-boundary.r3.3.v1", Tn = Object.freeze({
	document_context: "הקשר מסמך",
	clause: "סעיף ראשי",
	subclause: "תת־סעיף",
	appendix_item: "פריט נספח"
}), En = Object.freeze({
	heading: "כותרת מבנית",
	operative: "הוראה חוזית",
	definition: "הגדרה חוזית",
	context: "הקשר מסמך"
}), Dn = Object.freeze({
	appendix: "נספח",
	approval: "אישור",
	authorization: "הסמכה",
	bond: "ערבות",
	change: "שינוי",
	commercial: "מסחרי",
	communication: "תקשורת",
	compliance: "עמידה בדרישות",
	completion: "השלמה",
	confidentiality: "סודיות",
	coordination: "תיאום",
	definitions: "הגדרות",
	delay: "עיכוב",
	dispute: "מחלוקת",
	document_context: "הקשר מסמך",
	documents: "מסמכים",
	execution: "ביצוע",
	extension: "הארכת מועד",
	insurance: "ביטוח",
	liability: "אחריות משפטית",
	milestone: "אבן דרך",
	notice: "הודעה",
	other: "אחר",
	ownership: "בעלות",
	parties: "צדדים להסכם",
	payment: "תשלום",
	quality: "איכות",
	responsibility: "אחריות",
	safety: "בטיחות",
	schedule: "לוח זמנים",
	scope: "תחולת העבודה",
	storage: "אחסון",
	termination: "סיום ההסכם",
	warranty: "אחריות בדק"
}), On = Object.freeze({
	a: "א׳",
	b: "ב׳",
	c: "ג׳",
	d: "ד׳",
	e: "ה׳",
	f: "ו׳",
	g: "ז׳",
	h: "ח׳",
	i: "ט׳",
	j: "י׳",
	k: "כ׳",
	l: "ל׳",
	m: "מ׳",
	n: "נ׳",
	o: "ס׳",
	p: "ע׳",
	q: "פ׳",
	r: "צ׳",
	s: "ק׳",
	t: "ר׳",
	u: "ש׳",
	v: "ת׳"
});
function kn(e) {
	return Tn[e] || "רשומת חוזה";
}
function An(e) {
	return En[e] || "רשומת חוזה";
}
function jn(e) {
	let t = String(e || "").trim();
	return Dn[t] ? Dn[t] : /[\u0590-\u05ff]/u.test(t) ? t : "תגית חוזית";
}
function Mn(e, t = null) {
	let n = String(e || "").trim(), r = n.match(/^appendix_([a-v])(?:\.(heading|.+))?$/u);
	if (r) {
		let e = On[r[1]] || r[1].toUpperCase();
		return !r[2] || r[2] === "heading" ? `כותרת נספח ${e}` : `נספח ${e}, סעיף ${r[2]}`;
	}
	return /^\d+(?:\.\d+)*$/u.test(n) ? `סעיף ${n}` : n.includes(".context.") ? t || "הקשר המסמך" : t || "רשומת חוזה";
}
function Nn(e) {
	return Mn(e);
}
function Pn(e = []) {
	let t = Array.isArray(e) ? e : [], n = /* @__PURE__ */ new Map();
	for (let e of t) {
		let t = String(e?.parentClauseKey || "").trim();
		t && n.set(t, (n.get(t) || 0) + 1);
	}
	return t.map((e) => {
		let t = Array.isArray(e?.hashtags) ? e.hashtags : [], r = n.get(String(e?.clauseKey || "")) || 0, i = Ln(e, {
			childCount: r,
			hashtags: t
		}), a = i === "heading" ? zn(e) : null, o = t.map(jn), s = (Array.isArray(e?.crossReferences) ? e.crossReferences : []).map((e) => ({
			...e,
			targetLabelHe: Nn(e?.targetClauseKey)
		})), c = {
			...e,
			childCount: r,
			structuralRole: i,
			structuralRoleLabelHe: An(i),
			structuralLeadHe: a,
			relationshipEligible: i === "operative",
			clauseTypeLabelHe: kn(e?.clauseType),
			displayLabelHe: Mn(e?.clauseKey, e?.clauseTitle),
			tagLabelsHe: o,
			crossReferences: s
		};
		return {
			...c,
			displayContentHe: In(c)
		};
	});
}
function Fn(e = {}) {
	let t = Pn(e?.clauses), n = t.reduce((e, t) => (e[t.structuralRole] = (e[t.structuralRole] || 0) + 1, e), {
		heading: 0,
		operative: 0,
		definition: 0,
		context: 0
	}), r = Object.fromEntries([
		"heading",
		"definition",
		"context"
	].map((e) => [e, t.filter((t) => t.structuralRole === e).map((e) => e.clauseKey)]));
	return {
		...e,
		presentationVersion: Cn,
		clauses: t,
		coverage: {
			...e?.coverage || {},
			operativeCount: n.operative,
			headingCount: n.heading,
			definitionCount: n.definition,
			contextCount: n.context
		},
		quality: {
			...e?.quality || {},
			roleCounts: n
		},
		relationshipsInputBoundary: {
			version: wn,
			eligibleClauseKeys: t.filter((e) => e.relationshipEligible).map((e) => e.clauseKey),
			excludedClauseKeysByRole: r
		}
	};
}
function In(e = {}) {
	let t = e.pageStart === e.pageEnd ? `עמוד ${e.pageStart}` : `עמודים ${e.pageStart}–${e.pageEnd}`;
	return [
		"מקור: מסמכי החוזה",
		e.displayLabelHe || Mn(e.clauseKey, e.clauseTitle),
		`סוג רשומה: ${e.clauseTypeLabelHe || kn(e.clauseType)}`,
		`תפקיד במסמך: ${e.structuralRoleLabelHe || An(e.structuralRole)}`,
		t,
		e.clauseTitle ? `כותרת: ${e.clauseTitle}` : null,
		e.summaryHe ? `תקציר: ${e.summaryHe}` : null,
		e.tagLabelsHe?.length ? `תגיות: ${e.tagLabelsHe.join(" · ")}` : null,
		e.crossReferences?.length ? `הפניות מפורשות: ${e.crossReferences.map((e) => e.referenceText).join(" | ")}` : null,
		e.rawText ? `טקסט מקורי:\n${e.rawText}` : null
	].filter(Boolean).join("\n");
}
function Ln(e, { childCount: t, hashtags: n }) {
	let r = String(e?.clauseType || "");
	return String(e?.clauseKey || "").endsWith(".heading") ? "heading" : r === "document_context" ? "context" : Rn(e, t) ? "heading" : n.includes("definitions") ? "definition" : "operative";
}
function Rn(e, t) {
	return e?.clauseType === "clause" && t > 0 && !!String(e?.clauseTitle || "").trim();
}
function zn(e) {
	let t = String(e?.rawText || "").split(/\r?\n/u).map((e) => e.trim()).filter(Boolean);
	return t.length > 1 ? t.slice(1).join(" ") : null;
}
//#endregion
//#region src/contracts/relationshipProposals.js
var Bn = "contracts-relationships-agent.r4.0.v1", Vn = "contracts-relationships-explicit-reference.r4.0.v1", Hn = Object.freeze({
	cross_reference: "הפניה מפורשת",
	supports_same_decision: "תומך באותה החלטה",
	depends_on: "תלוי ב־",
	condition_of: "תנאי של",
	exception_to: "חריג ל־",
	amends: "מתקן את",
	duplicates: "כפילות של",
	conflicts_with: "סותר את",
	split_into: "פוצלה אל",
	merged_into: "מוזגה אל"
}), Un = Object.freeze({
	explicit_reference: "הפניה שכתובה בחוזה",
	deterministic: "כלל דטרמיניסטי",
	model: "הצעת מודל",
	human: "החלטת סוקר",
	system: "פעולת מערכת"
}), Wn = Object.freeze({
	proposed: "מוצע לסקירה",
	approved: "אושר",
	corrected: "תוקן ואושר",
	rejected: "נדחה",
	superseded: "הוחלף",
	unresolved: "לא פתור"
});
function Gn(e) {
	return Hn[e] || "קשר חוזי";
}
function Kn(e) {
	return Un[e] || "מקור קשר לא ידוע";
}
function qn(e) {
	return Wn[e] || "ממתין לסקירה";
}
function Jn(e = {}) {
	let t = Pn(e?.clauses), n = new Map(t.map((e) => [String(e.clauseKey || ""), e])), r = /* @__PURE__ */ new Map(), i = [], a = 0;
	for (let e of t) for (let t of Array.isArray(e.crossReferences) ? e.crossReferences : []) {
		a += 1;
		let o = String(t?.targetClauseKey || "").trim(), s = n.get(o);
		if (t?.resolution !== "resolved" || !s || o === e.clauseKey) {
			i.push({
				sourceClauseKey: e.clauseKey,
				sourceLabelHe: e.displayLabelHe || Mn(e.clauseKey, e.clauseTitle),
				targetClauseKey: o,
				targetLabelHe: t?.targetLabelHe || Nn(o),
				referenceText: String(t?.referenceText || "").trim(),
				referenceKind: t?.referenceKind || "clause",
				reason: o === e.clauseKey ? "self_reference" : "target_missing",
				reasonHe: o === e.clauseKey ? "ההפניה מצביעה לאותה רשומה ולכן לא נוצר קשר עצמי." : "יעד ההפניה לא נמצא בגרסת החוזה שנשמרה."
			});
			continue;
		}
		let c = `${e.clauseKey}\u001f${s.clauseKey}\u001fcross_reference`, l = r.get(c);
		if (l) {
			l.referenceTexts.includes(t.referenceText) || l.referenceTexts.push(t.referenceText), l.referenceKinds.includes(t.referenceKind) || l.referenceKinds.push(t.referenceKind);
			continue;
		}
		r.set(c, {
			proposalKey: c,
			relationshipType: "cross_reference",
			relationshipTypeLabelHe: Gn("cross_reference"),
			origin: "explicit_reference",
			originLabelHe: Kn("explicit_reference"),
			confidence: null,
			reviewStatus: "proposed",
			reviewStatusLabelHe: qn("proposed"),
			sourceClauseKey: e.clauseKey,
			sourceLabelHe: e.displayLabelHe || Mn(e.clauseKey, e.clauseTitle),
			sourceSummaryHe: e.summaryHe,
			sourcePageStart: e.pageStart,
			sourcePageEnd: e.pageEnd,
			sourceRawText: e.rawText,
			sourceRawTextSha256: e.rawTextSha256,
			targetClauseKey: s.clauseKey,
			targetLabelHe: s.displayLabelHe || Mn(s.clauseKey, s.clauseTitle),
			targetSummaryHe: s.summaryHe,
			targetPageStart: s.pageStart,
			targetPageEnd: s.pageEnd,
			targetRawText: s.rawText,
			targetRawTextSha256: s.rawTextSha256,
			referenceTexts: [t.referenceText],
			referenceKinds: [t.referenceKind],
			rationaleHe: `ב${e.displayLabelHe || Mn(e.clauseKey, e.clauseTitle)} נמצאה הפניה מפורשת אל ${s.displayLabelHe || Mn(s.clauseKey, s.clauseTitle)}. הקשר מתעד את ההפניה בלבד ואינו מוכיח ששתי הרשומות שייכות לאותה החלטה.`
		});
	}
	let o = [...r.values()].map((e) => ({
		...e,
		referenceTexts: [...e.referenceTexts].sort((e, t) => e.localeCompare(t, "he")),
		referenceKinds: [...e.referenceKinds].sort()
	}));
	return {
		agentVersion: Bn,
		relationshipPolicyVersion: Vn,
		scope: "explicit_references_only",
		proposals: o,
		unresolvedReferences: i,
		metrics: {
			explicitReferenceCount: a,
			explicitRelationshipCount: o.length,
			unresolvedReferenceCount: i.length,
			modelRelationshipCount: 0,
			decisionCount: 0,
			scheduleWriteCount: 0
		},
		gates: {
			modelGroupingEnabled: !1,
			decisionCreationEnabled: !1,
			conflictResolutionEnabled: !1,
			scheduleWritesEnabled: !1
		}
	};
}
//#endregion
//#region src/react/contractsHebrew.js
var Yn = Object.freeze({
	contractual_completion: "השלמת ומסירת העבודות",
	contractual_commencement: "תחילת העבודה החוזית",
	contractual_obligation: "התחייבות חוזית",
	fixed_completion: "מועד השלמה חוזי קבוע",
	daily_delay_charge: "חיוב יומי בגין איחור בהשלמה",
	exceptional_event_notice: "הודעה בכתב על אירוע חריג",
	weekly_waste_removal: "פינוי שבועי של פסולת בנייה",
	monthly_payment_chain: "בדיקת חשבון חודשי ותשלום",
	owner_requested_delay_relief: "דחיית מועד עקב עיכוב שביקש המזמין",
	approved_extension: "הארכת מועד מאושרת",
	completion_inspection: "בדיקת השלמת העבודות",
	manager_set_corrections: "תיקונים במועד שיקבע המפקח",
	performance_bond_delivery: "מסירת ערבות ביצוע",
	performance_bond_renewal: "הארכת ערבות ביצוע",
	notice_service: "מועד קבלת הודעה לפי אופן המסירה"
}), Xn = Object.freeze({
	contractual_completion: "השלם ומסור את העבודות",
	contractual_commencement: "התחל את העבודות במועד החוזי",
	contractual_obligation: "בצע את ההתחייבות החוזית",
	fixed_completion: "השלם את העבודות במועד החוזי הקבוע",
	daily_delay_charge: "שלם חיוב יומי בגין איחור בהשלמה",
	exceptional_event_notice: "מסור הודעה בכתב על אירוע חריג",
	weekly_waste_removal: "פנה פסולת בנייה שהצטברה",
	monthly_payment_chain: "בדוק את החשבון החודשי ושלם את הסכום המאושר",
	owner_requested_delay_relief: "אפשר דחייה מתאימה בגין עיכוב מזכה שביקש המזמין",
	approved_extension: "החל את הארכת המועד המאושרת",
	completion_inspection: "השלם את בדיקת העבודות",
	manager_set_corrections: "השלם את התיקונים בתוך התקופה שיקבע המפקח",
	performance_bond_delivery: "מסור את ערבות הביצוע",
	performance_bond_renewal: "הארך את ערבות הביצוע לפני פקיעתה",
	notice_service: "קבע את מועד קבלת ההודעה לפי אופן המסירה"
}), Zn = Object.freeze({
	authority_unverified: "סמכות המסמך טרם אומתה",
	human_review_required: "נדרשת סקירה אנושית",
	project_binding_unreviewed: "קישור הפרויקט טרם נבדק",
	commencement_event_missing: "חסר אירוע תחילת עבודה",
	trigger_event_missing: "חסר אירוע מפעיל",
	execution_date_unverified: "מועד החתימה טרם אומת",
	inspection_start_event_missing: "חסר אירוע תחילת בדיקה",
	inspection_start_due_missing: "מועד תחילת הבדיקה אינו ידוע",
	bond_expiry_event_missing: "חסר מועד פקיעת הערבות",
	working_calendar_missing: "חסר לוח ימי עבודה מאושר",
	calendar_semantics_unresolved: "משמעות הימים טרם הוכרעה",
	subday_deadline_not_storable_as_date: "לא ניתן לשמור מועד קצר מיום כתאריך",
	compliance_engine_not_approved: "מנוע בדיקת הציות טרם אושר",
	recurring_occurrence_history_not_supported: "היסטוריית מופעים חוזרים עדיין אינה נתמכת",
	compound_rule_not_supported: "כלל חוזי מורכב עדיין אינו נתמך",
	approval_guard_not_supported: "תנאי האישור עדיין אינו נתמך",
	extension_event_missing: "חסר אירוע הארכת מועד",
	quantified_days_missing: "חסר מספר ימים מפורש",
	entitlement_review_required: "נדרשת בדיקת זכאות",
	extension_approval_review_required: "נדרשת בדיקת אישור הארכה",
	existing_milestone_identity_required: "נדרש זיהוי של אבן דרך קיימת",
	offset_missing: "חסר מרווח זמן",
	future_manager_decision_required: "נדרשת החלטה עתידית של המפקח",
	negative_offset_not_supported: "מרווח זמן שלילי אינו נתמך",
	branching_rule_not_supported: "כלל מסועף עדיין אינו נתמך",
	channel_specific_clock_not_supported: "מנגנון זמנים לפי ערוץ מסירה עדיין אינו נתמך",
	material_value_conflict: "קיימת סתירה בערך מהותי",
	contract_conflict_unresolved: "סתירה חוזית טרם נפתרה",
	responsible_party_unverified: "זהות הגורם האחראי טרם אומתה",
	beneficiary_unverified: "זהות הגורם הזכאי טרם אומתה",
	unreadable_pdf_page: "עמוד בחוזה אינו קריא"
}), Qn = Object.freeze({
	human_review_required: "נדרשת סקירה אנושית",
	project_mapping_inactive: "קישור הפרויקט אינו פעיל",
	schedule_version_conflict: "קיימת סתירה בגרסת לוח הזמנים",
	trigger_evidence_unreviewed: "ראיות האירוע המפעיל טרם נבדקו",
	no_mapping_candidate: "לא נמצאה פעילות מתאימה",
	ambiguous_candidates: "נמצאו כמה חלופות בעלות התאמה זהה",
	canonical_alias_conflict: "קיימת סתירה בזהות הפעילות הקבועה",
	invalid_canonical_key: "זהות הפעילות הקבועה אינה תקינה",
	previous_activity_not_found: "הפעילות מהגרסה הקודמת לא נמצאה",
	current_activity_not_found: "הפעילות בגרסה הנוכחית לא נמצאה",
	duplicate_previous_task_uid: "מזהה פעילות כפול בגרסה הקודמת",
	duplicate_current_task_uid: "מזהה פעילות כפול בגרסה הנוכחית",
	identity_continuity_requires_review: "רציפות זהות הפעילות דורשת סקירה",
	summary_activity_requires_review: "פעילות סיכום דורשת סקירה מפורשת",
	prior_mapping_confidence_below_continuity_gate: "רמת הביטחון הקודמת נמוכה מסף הרציפות"
}), $n = Object.freeze({
	schema_reuse_not_approved: "שימוש חוזר במבנה הנתונים טרם אושר",
	project_namespace_not_approved: "מרחב מזהי הפרויקט טרם אושר",
	review_audit_persistence_not_approved: "שמירת יומן הסקירה טרם אושרה",
	atomic_promotion_not_approved: "הקידום האטומי טרם אושר",
	permission_model_not_approved: "מודל ההרשאות טרם אושר",
	source_extraction_mode_invalid: "מצב החילוץ אינו מתאים לקידום",
	document_version_missing: "חסרה גרסת מסמך מזוהה",
	review_batch_missing: "חסרה קבוצת החלטות סקירה",
	review_batch_id_missing: "חסר מזהה לקבוצת הסקירה",
	reviewer_identity_invalid: "זהות הסוקר אינה תקינה",
	review_timestamp_invalid: "מועד הסקירה אינו תקין",
	review_reason_insufficient: "נימוק הסקירה קצר מדי",
	document_authority_not_approved: "סמכות המסמך טרם אושרה",
	project_mapping_missing: "חסר קישור בין הפרויקטים",
	project_mapping_not_approved: "קישור הפרויקטים טרם אושר",
	schedule_project_id_invalid: "מזהה פרויקט לוח הזמנים אינו תקין",
	source_project_id_missing: "חסר מזהה פרויקט המקור",
	source_project_id_invalid: "מזהה פרויקט המקור אינו תקין",
	source_project_binding_mismatch: "פרויקט המקור אינו תואם לקישור שנבדק",
	project_mapping_approver_missing: "חסרה זהות מאשר קישור הפרויקטים",
	project_mapping_timestamp_invalid: "מועד אישור קישור הפרויקטים אינו תקין",
	cross_database_mapping_reason_missing: "חסר נימוק לקישור בין מאגרי הנתונים",
	unsupported_review_action: "פעולת הסקירה אינה נתמכת",
	candidate_storage_target_not_operational: "יעד השמירה עדיין אינו תפעולי",
	review_confidence_invalid: "רמת הביטחון של הסקירה אינה תקינה",
	exact_evidence_missing: "חסרה ראיה מדויקת מן החוזה",
	conflict_review_missing: "חסרה החלטה מפורשת בסתירה",
	conflict_selection_not_exclusive: "יש לבחור חלופה יחידה מתוך הסתירה",
	fixed_milestone_date_invalid: "מועד אבן הדרך אינו תקין",
	condition_anchor_missing: "חסר אירוע עוגן לתנאי",
	condition_offset_invalid: "מרווח הזמן של התנאי אינו תקין",
	condition_direction_not_supported: "כיוון מרווח הזמן אינו נתמך",
	condition_offset_unit_not_approved: "יחידת הזמן של התנאי טרם אושרה",
	extension_days_invalid: "מספר ימי ההארכה אינו תקין",
	extension_unit_not_supported: "יחידת הארכת המועד אינה נתמכת",
	extension_approval_invalid: "אישור הארכת המועד אינו תקין",
	extension_milestone_identity_missing: "חסרה אבן הדרך שאליה שייכת ההארכה",
	review_decision_missing: "חסרה החלטת סוקר",
	transaction_batch_blocked: "קבוצת הקידום חסומה"
}), er = Object.freeze({
	reviewed_indicator_impact: "החלטה חוזית שנבדקה וסומנה כרלוונטית ל־Indicator",
	no_indicator_impact: "החלטה חוזית שנבדקה ואינה דורשת טיפול של Indicator",
	indicator_suitability_unknown: "ההתאמה ל־Indicator טרם הוכרעה בסקירת ההחלטה",
	indicator_suitability_invalid: "ערך ההתאמה ל־Indicator אינו תקין",
	decision_embedding_missing: "וקטור ההחלטה עדיין חסר ולכן היא אינה מוכנה למסירה ל־Indicator",
	decision_not_reviewed: "ההחלטה עדיין אינה בגרסת אישור או תיקון סופית",
	decision_inactive: "החלטה שנדחתה, פוצלה, מוזגה או הוחלפה אינה נמסרת ל־Indicator",
	decision_conflict_unresolved: "ההחלטה מכילה סתירה שלא הוכרעה",
	decision_conflict_not_reviewed: "זוהתה סתירה שטרם סומנה כבדוקה"
}), tr = Object.freeze({
	contracts_model_provider_timeout: "ספק הבינה המלאכותית לא השלים את החילוץ בזמן. לא נשמרה תוצאה חלקית; בניסיון הבא המערכת תשתמש מחדש רק בחלקים שכבר אומתו.",
	contracts_model_time_budget_exceeded: "חילוץ החוזה חרג ממגבלת הזמן הכוללת. לא נשמרה תוצאה חלקית; אפשר לנסות שוב.",
	contracts_model_provider_failed: "ספק הבינה המלאכותית לא הצליח להשלים את חילוץ החוזה. לא נשמרה תוצאה חלקית; אפשר לנסות שוב.",
	contracts_ai_unavailable: "שירות הבינה המלאכותית לחילוץ חוזים אינו מוגדר כעת בצד השרת.",
	contracts_promotion_migration_missing: "תשתית שמירת הסקירה אינה זמינה כעת בצד השרת.",
	contracts_activity_mapping_history_migration_missing: "היסטוריית החלטות המיפוי עדיין אינה זמינה בצד השרת.",
	contracts_activity_mapping_review_migration_missing: "תשתית שמירת החלטות המיפוי עדיין אינה זמינה בצד השרת.",
	contracts_activity_mapping_review_apply_not_approved: "שמירת החלטות מיפוי מושבתת בצד השרת.",
	contracts_activity_mapping_review_selection_stale: "הפעילות שנבחרה כבר אינה מופיעה בחלופות העדכניות. יש לרענן ולבחור מחדש.",
	contracts_activity_mapping_review_conflict_unresolved: "יש לפתור את הסתירה במפורש לפני אישור או תיקון.",
	contracts_activity_mapping_review_blocked: "המיפוי עדיין חסום ואינו בטוח לשמירה.",
	contracts_activity_mapping_context_not_found: "לא נמצא קישור פעיל ומאושר בין פרויקט המקור לפרויקט לוח הזמנים.",
	contracts_activity_mapping_schedule_not_found: "לא נמצאה גרסת לוח זמנים מאושרת לפרויקט.",
	contracts_activity_mapping_database_missing: "חיבור השרת למאגר לוח הזמנים אינו מוגדר.",
	contracts_activity_mapping_database_override_rejected: "הבקשה נדחתה משום שניסתה לשנות את חיבור מסד הנתונים שבבעלות השרת.",
	contracts_workspace_persistence_not_enabled: "שמירת חוזים קבועה עדיין אינה מופעלת בצד השרת.",
	contracts_workspace_migration_missing: "תשתית החוזים השמורים עדיין אינה זמינה ב-APP DATA/KAPAIM.",
	contracts_workspace_database_missing: "חיבור השרת למאגר החוזים השמורים אינו מוגדר.",
	contracts_workspace_storage_bucket_missing: "דלי האחסון הפרטי לחוזים עדיין לא הוגדר.",
	contracts_workspace_storage_bucket_not_private: "דלי אחסון החוזים חייב להיות פרטי לפני שניתן לשמור מסמכים.",
	contracts_workspace_storage_upload_failed: "שמירת קובץ ה-PDF הפרטי נכשלה. תוצאת החילוץ לא נרשמה כחוזה שמור.",
	contracts_workspace_storage_failed: "בדיקת אחסון החוזים נכשלה בצד השרת.",
	contracts_workspace_conflict: "החוזה השמור השתנה או מתנגש עם גרסה קיימת. יש לרענן ולנסות שוב.",
	contracts_workspace_not_found: "החוזה השמור לא נמצא או שאינו זמין עוד.",
	contracts_workspace_timeout: "שמירת החוזה חרגה ממגבלת הזמן. אפשר לרענן את רשימת החוזים ולבדוק אם נשמר.",
	contracts_workspace_transport_failed: "השרת לא הצליח להגיע למאגר החוזים השמורים.",
	contracts_workspace_database_override_rejected: "הבקשה נדחתה משום שניסתה לשנות את חיבור מאגר החוזים שבבעלות השרת.",
	contracts_clause_persistence_not_enabled: "שמירת כל תוצאת סוכן החוזים עדיין אינה מופעלת בצד השרת.",
	contracts_clause_persistence_not_found: "חילוץ הסעיפים השמור לא נמצא או שאינו זמין עוד.",
	contracts_clause_persistence_timeout: "שמירת חילוץ הסעיפים חרגה ממגבלת הזמן. אפשר לרענן את רשימת החילוצים ולבדוק אם נשמר.",
	contracts_clause_persistence_response_invalid: "השמירה הושלמה אך תוצאת חילוץ הסעיפים שחזרה ממאגר הנתונים אינה תקינה. יש לבדוק את לוג השרת.",
	contracts_clause_persistence_storage_upload_failed: "שמירת קובץ ה־PDF הפרטי נכשלה, ולכן חילוץ הסעיפים לא נרשם.",
	contracts_clause_persistence_database_override_rejected: "הבקשה נדחתה משום שניסתה לשנות את חיבור מאגר חילוצי הסעיפים שבבעלות השרת.",
	contracts_relationships_not_enabled: "שמירת הצעות הקשר של סוכן הקשרים עדיין אינה מופעלת בצד השרת.",
	contracts_relationships_workspace_not_found: "חילוץ הסעיפים השמור שעליו מבוסס סוכן הקשרים לא נמצא.",
	contracts_relationships_request_invalid: "בקשת סוכן הקשרים אינה תקינה.",
	contracts_relationships_response_invalid: "תוצאת סוכן הקשרים שחזרה ממאגר הנתונים אינה תקינה. יש לבדוק את לוג השרת.",
	contracts_relationships_database_override_rejected: "הבקשה נדחתה משום שניסתה לשנות את חיבור מאגר הקשרים שבבעלות השרת.",
	contracts_relationship_review_not_enabled: "שמירת הצעות הקשר וסקירת R4.2A עדיין אינן מופעלות בצד השרת.",
	contracts_relationship_review_migration_missing: "מיגרציית R4.2A לשמירת הצעות קשר וסקירתן עדיין אינה זמינה ב־KAPAIM.",
	contracts_relationship_review_workspace_not_found: "חילוץ הסעיפים השמור שעליו מבוססת סקירת הקשרים לא נמצא.",
	contracts_relationship_review_request_invalid: "החלטת סקירת הקשר אינה תקינה. יש להשלים נימוק בעברית ולבדוק את פרטי התיקון.",
	contracts_relationship_review_analysis_incomplete: "הניתוח לא נשמר משום שסיווג או בדיקה ספקנית לא הושלמו לכל הזוגות. אפשר להריץ שוב.",
	contracts_relationship_review_stale: "הצעת הקשר השתנתה בחלון אחר. הרשימה העדכנית נטענה בלי לדרוס את ההחלטה החדשה יותר.",
	contracts_relationship_review_conflict: "התיקון מתנגש בקשר קיים או בגרסה חדשה יותר. יש לרענן ולבדוק את הרשימה.",
	contracts_relationship_review_rpc_failed: "מאגר KAPAIM דחה את שמירת סקירת הקשר. פרטי הדחייה נרשמו בטרמינל השרת.",
	contracts_relationship_review_response_invalid: "תוצאת סקירת הקשרים שחזרה מ־KAPAIM אינה תקינה. יש לבדוק את לוג השרת.",
	contracts_relationship_auto_review_not_enabled: "האישור האוטומטי דורש שמסלול סקירת הקשרים R4.2A יהיה פעיל בשרת.",
	contracts_relationship_auto_review_migration_missing: "מיגרציית R4.2A.1 לאישור אוטומטי בטוח עדיין אינה זמינה ב־KAPAIM.",
	contracts_relationship_auto_review_request_invalid: "בקשת האישור האוטומטי אינה תקינה. השרת אינו מקבל קשרים, ספים או החלטות מהדפדפן.",
	contracts_relationship_auto_review_stale: "אחד הקשרים השתנה בזמן האישור האוטומטי. הרשימה העדכנית נטענה בלי לדרוס החלטה חדשה יותר.",
	contracts_relationship_auto_review_rpc_failed: "KAPAIM דחה את האישור האוטומטי. לא בוצעו דחיות, תיקונים או כתיבות ללוח הזמנים.",
	contracts_relationship_auto_review_response_invalid: "תוצאת האישור האוטומטי שחזרה מ־KAPAIM אינה תקינה. יש לבדוק את לוג השרת.",
	contracts_decisions_database_override_rejected: "הבקשה נדחתה משום שניסתה לשנות את חיבור מאגר ההחלטות שבבעלות השרת.",
	contracts_decision_review_not_enabled: "יצירת הצעות החלטה וסקירת R4.2B עדיין אינן מופעלות בצד השרת.",
	contracts_decision_review_migration_missing: "מיגרציית R4.2B להצעות החלטה ולסקירתן עדיין אינה זמינה ב־KAPAIM.",
	contracts_decision_review_workspace_not_found: "חילוץ הסעיפים השמור שעליו מבוססות הצעות ההחלטה לא נמצא.",
	contracts_decision_review_request_invalid: "החלטת הסקירה אינה תקינה. יש להשלים נימוק בעברית ולבדוק את פרטי התיקון.",
	contracts_decision_review_stale: "הצעת ההחלטה השתנתה בחלון אחר. הרשימה העדכנית נטענה בלי לדרוס את ההחלטה החדשה יותר.",
	contracts_decision_review_conflict: "הסקירה מתנגשת בהחלטה קיימת או בגרסה חדשה יותר. יש לרענן ולבדוק את הרשימה.",
	contracts_decision_review_rpc_failed: "מאגר KAPAIM דחה את שמירת הצעת ההחלטה או הסקירה. פרטי הדחייה נרשמו בטרמינל השרת.",
	contracts_decision_review_response_invalid: "תוצאת סקירת ההחלטות שחזרה מ־KAPAIM אינה תקינה. יש לבדוק את לוג השרת.",
	contracts_decision_auto_review_not_enabled: "האישור האוטומטי דורש שמסלולי R4.2B ו־R6 יהיו פעילים בשרת.",
	contracts_decision_auto_review_migration_missing: "מיגרציית R4.2B.1 לאישור אוטומטי בטוח עדיין אינה זמינה ב־KAPAIM.",
	contracts_decision_auto_review_request_invalid: "בקשת האישור האוטומטי אינה תקינה. השרת אינו מקבל החלטות, ספים, ראיות או הגדרות מודל מהדפדפן.",
	contracts_decision_auto_review_unavailable: "מפתח המודל לבודק ההחלטות העצמאי אינו זמין בצד השרת.",
	contracts_decision_auto_review_stale: "אחת ההחלטות השתנתה בזמן האישור האוטומטי. הרשימה העדכנית נטענה בלי לדרוס החלטה חדשה יותר.",
	contracts_decision_auto_review_rpc_failed: "KAPAIM דחה את האישור האוטומטי. לא בוצעו דחיות, תיקונים, מסירות ל־Indicator או כתיבות ללוח הזמנים.",
	contracts_decision_auto_review_response_invalid: "תוצאת האישור האוטומטי שחזרה מ־KAPAIM אינה תקינה. יש לבדוק את לוג השרת.",
	contracts_decision_relationship_review_incomplete: "יש לסיים את הסקירה של כל קשרי R4.2A לפני יצירת הצעות החלטה.",
	contracts_decision_normalization_input_invalid: "הסעיפים או הקשרים השמורים אינם מתאימים ליצירת הצעות החלטה בטוחה.",
	contracts_decision_normalization_unavailable: "מפתח המודל של סוכן ההחלטות אינו זמין בצד השרת.",
	contracts_decision_normalization_token_budget_exceeded: "החוזה חרג מתקציב הניתוח הבטוח של R4.2B. לא נשמרה תוצאה חלקית.",
	contracts_decision_normalization_time_budget_exceeded: "יצירת הצעות ההחלטה חרגה ממגבלת הזמן. לא נשמרה תוצאה חלקית; אפשר לנסות שוב.",
	contracts_decision_normalization_provider_failed: "ספק הבינה המלאכותית לא השלים את יצירת הצעות ההחלטה. לא נשמרה תוצאה חלקית.",
	contracts_decision_normalization_output_invalid: "המודל החזיר הצעת החלטה שאינה עומדת בכללי R4.2B. לא נשמרה תוצאה חלקית.",
	contracts_decision_normalization_incomplete: "הניתוח לא נשמר משום שלא הושלמה הצעת החלטה תקינה לכל קבוצת סעיפים.",
	contracts_decision_normalization_ungrounded_party: "המודל ציין גורם שאינו מופיע בסעיפי המקור. ההצעה נדחתה ולא נשמרה.",
	contracts_decision_normalization_temporal_invalid: "המודל החזיר כלל זמנים שאינו מעוגן במלואו בסעיפי המקור. ההצעה נדחתה.",
	contracts_decision_normalization_ungrounded_numeric_fact: "המודל הוסיף פרט מספרי שאינו מופיע בסעיפי המקור. ההצעה נדחתה ולא נשמרה.",
	contracts_decision_lineage_not_enabled: "פעולות הפיצול והמיזוג של R4.2C עדיין אינן מופעלות בצד השרת.",
	contracts_decision_lineage_migration_missing: "מיגרציית R4.2C לפיצול, מיזוג ושמירת יוחסין עדיין אינה זמינה ב־KAPAIM.",
	contracts_decision_lineage_workspace_not_found: "חילוץ הסעיפים השמור שעליו מבוססת פעולת הפיצול או המיזוג לא נמצא.",
	contracts_decision_lineage_request_invalid: "בקשת הפיצול או המיזוג אינה תקינה. יש לבדוק את הראיות, השדות והנימוק בעברית.",
	contracts_decision_lineage_stale: "אחת ההחלטות השתנתה בחלון אחר. הרשימה העדכנית נטענה בלי לדרוס את הגרסה החדשה יותר.",
	contracts_decision_lineage_conflict: "לא ניתן לשמור את הפיצול או המיזוג משום שהראיות או היוחסין אינם תואמים עוד למצב השמור.",
	contracts_decision_lineage_rpc_failed: "מאגר KAPAIM דחה את פעולת הפיצול או המיזוג. פרטי הדחייה נרשמו בטרמינל השרת.",
	contracts_decision_lineage_response_invalid: "תוצאת R4.2C שחזרה מ־KAPAIM אינה שלמה או אינה תקינה. לא הוצגה תוצאה חלקית.",
	contracts_indicator_handoff_not_enabled: "ערכת המסירה ל־Indicator עדיין אינה מופעלת בצד השרת.",
	contracts_indicator_handoff_migration_missing: "מקור הקריאה החדש של R6 עדיין אינו זמין ב־KAPAIM.",
	contracts_indicator_handoff_workspace_not_found: "סביבת החוזה המבוקשת לא נמצאה ב־KAPAIM.",
	contracts_indicator_handoff_request_invalid: "בקשת ערכת המסירה ל־Indicator אינה תקינה.",
	contracts_indicator_handoff_source_invalid: "החלטות R4.2 השמורות אינן שלמות מספיק למסירה בטוחה ל־Indicator.",
	contracts_indicator_handoff_safety_violation: "ערכת המסירה נעצרה משום שגבול האפס־כתיבות או ספירת ההחלטות לא נשמר.",
	contracts_workspace_rpc_failed: "מאגר KAPAIM דחה את שמירת חילוץ הסעיפים. פרטי הדחייה נרשמו בטרמינל של השרת.",
	contracts_response_too_large: "חילוץ הסעיפים הושלם, אך התוצאה גדולה ממגבלת התצוגה של השרת.",
	contracts_clause_enrichment_unavailable: "מפתח המודל של סוכן החוזים אינו זמין בצד השרת. יש לבדוק את OPENROUTER_API_KEY ולהפעיל מחדש את השרת.",
	contracts_clause_enrichment_token_budget_exceeded: "החוזה חרג מתקציב הפלט המוגדר להעשרת הסעיפים. לא נשמרה תוצאה חלקית.",
	contracts_clause_enrichment_time_budget_exceeded: "העשרת כל סעיפי החוזה חרגה ממגבלת הזמן. לא נשמרה תוצאה חלקית; אפשר לנסות שוב.",
	contracts_clause_enrichment_provider_failed: "ספק הבינה המלאכותית לא השלים את העשרת סעיפי החוזה. לא נשמרה תוצאה חלקית; אפשר לנסות שוב.",
	contracts_clause_enrichment_ungrounded_numeric_fact: "המודל הוסיף לתקציר מספר שאינו מופיע בסעיף המקור. התוצאה נדחתה ולא נשמר מידע לא מבוסס.",
	contracts_semantic_relationships_not_enabled: "תצוגת קשרי R4.1 אינה מופעלת בשרת. יש לבדוק את האישור המקומי ולהפעיל מחדש את השרת.",
	contracts_semantic_relationships_unavailable: "מפתח המודל של סוכן הקשרים אינו זמין בצד השרת. יש לבדוק את ההגדרה ולהפעיל מחדש את השרת.",
	contracts_semantic_relationships_request_invalid: "בקשת תצוגת הקשרים אינה תקינה. יש לרענן את העמוד ולנסות שוב.",
	contracts_semantic_relationships_token_budget_exceeded: "החוזה חרג מתקציב הניתוח הבטוח של קשרי R4.1. לא נשמרה תוצאה חלקית.",
	contracts_semantic_relationships_time_budget_exceeded: "ניתוח הקשרים חרג ממגבלת הזמן הכוללת. לא נשמרה תוצאה חלקית; אפשר לנסות שוב.",
	contracts_semantic_relationships_provider_failed: "ספק הבינה המלאכותית לא השלים את סיווג זוגות הסעיפים. לא נשמרה תוצאה חלקית; אפשר לנסות שוב.",
	contracts_semantic_relationships_verifier_failed: "הבדיקה הספקנית של הצעות הקשר לא הושלמה. ההצעות שלא אומתו אינן מוצגות; אפשר להריץ שוב.",
	contracts_semantic_relationships_json_invalid: "ספק הבינה המלאכותית החזיר סיווג שאינו תקין גם לאחר ניסיון תיקון. לא נשמרה תוצאה חלקית; אפשר לנסות שוב.",
	contracts_semantic_relationships_schema_invalid: "ספק הבינה המלאכותית החזיר מבנה סיווג שאינו תקין גם לאחר ניסיון תיקון. לא נשמרה תוצאה חלקית; אפשר לנסות שוב.",
	contracts_semantic_relationships_verifier_json_invalid: "הבדיקה הספקנית החזירה תשובה לא תקינה. הזוגות שלא אומתו הושמטו בבטחה מהתצוגה.",
	contracts_semantic_relationships_verifier_schema_invalid: "הבדיקה הספקנית החזירה מבנה לא תקין. הזוגות שלא אומתו הושמטו בבטחה מהתצוגה.",
	contracts_semantic_relationships_response_invalid: "תוצאת סוכן הקשרים חרגה מגבולות הבטיחות של R4.1 ולכן נדחתה ולא נשמרה."
}), nr = Object.freeze({
	candidate_for_schedule_contract_milestones: "מועמד לאבן דרך חוזית",
	candidate_for_schedule_contract_extensions: "מועמד להארכת מועד חוזית",
	candidate_for_schedule_contract_conditions: "מועמד לתנאי חוזי ממתין",
	dry_run_only: "סקירה בלבד — ללא יעד תפעולי"
}), rr = Object.freeze({
	contract_source: "ציטוט מדויק מן החוזה",
	preferred_activity_key_exact: "התאמה מלאה למזהה פעילות מועדף",
	preferred_task_uid_exact: "התאמה מלאה למזהה משימה",
	normalized_name_exact: "התאמה מלאה בשם הפעילות",
	token_overlap: "חפיפה במונחי הפעילות",
	milestone_preference: "התאמה להעדפת אבן דרך",
	outline_level_preference: "התאמה לרמת ההיררכיה",
	summary_activity_penalty: "הפחתת ביטחון משום שזו פעילות סיכום",
	confirmed_alias_owner: "זהות פעילות שכבר אושרה",
	conflicting_alias_owners: "סתירה בין זהויות פעילות קיימות",
	invalid_canonical_owner: "זהות פעילות קיימת אינה תקינה"
}), ir = Object.freeze({
	day: "ימים",
	calendar_day: "ימים קלנדריים",
	calendar_days: "ימים קלנדריים",
	working_day: "ימי עבודה",
	working_days: "ימי עבודה",
	week: "שבועות",
	weeks: "שבועות",
	month: "חודשים",
	months: "חודשים",
	hour: "שעות",
	hours: "שעות"
}), ar = Object.freeze({
	after: "לאחר האירוע המפעיל",
	before: "לפני האירוע המפעיל"
});
function or(e) {
	return Yn[e] || "עובדה חוזית הדורשת סקירה";
}
function sr(e) {
	return Xn[typeof e == "string" ? e : e?.role] || "בדוק את העובדה החוזית מול הראיה המקורית";
}
function cr(e) {
	return Zn[e] || "נדרש בירור נוסף לפני קידום";
}
function lr(e) {
	return Qn[e] || cr(e);
}
function ur(e) {
	let t = String(e || "");
	return t.startsWith("review_gate_unresolved:") ? `חסם סקירה טרם נפתר: ${cr(t.slice(23))}` : t.startsWith("unknown_review_candidate:") ? "התקבלה החלטה עבור מועמד שאינו קיים בחילוץ הנוכחי" : t.startsWith("duplicate_review_decision:") ? "נמצאו כמה החלטות עבור אותו מועמד" : $n[t] || "הקידום חסום ונדרשת בדיקה נוספת";
}
function dr(e) {
	return er[String(e || "")] || "נדרשת בדיקה נוספת לפני מסירה ל־Indicator";
}
function fr(e) {
	return {
		suitable: "מתאימה למסירה ל־Indicator",
		not_suitable: "אינה מתאימה למסירה",
		requires_review: "דורשת סקירה חוזית"
	}[e] || "מצב מסירה לא ידוע";
}
function pr(e) {
	return nr[e] || "אין יעד תפעולי מאושר בשלב זה";
}
function mr(e) {
	return {
		confirm: "אישור",
		reject: "דחייה",
		correct: "תיקון",
		unmapped: "ללא מיפוי"
	}[e] || "החלטת סקירה";
}
function hr(e) {
	return {
		suggested: "הוצעו חלופות לסקירה",
		blocked: "חסום עד לפתרון מפורש",
		unmapped: "לא נמצאה חלופה",
		not_required: "לא נדרש קישור לפעילות",
		pending_trigger: "ממתין לאימות האירוע המפעיל",
		manually_confirmed: "אושר ידנית",
		auto_confirmed: "המשכיות זהות אושרה אוטומטית",
		rejected: "נדחה"
	}[e] || "מצב דורש בדיקה";
}
function gr(e) {
	return {
		transaction_ready: "מוכן לטרנזקציה",
		blocked: "חסום",
		rejected: "נדחה"
	}[e] || "מצב טרם נקבע";
}
function _r(e) {
	return rr[e] || "ראיית התאמה ללוח הזמנים";
}
function vr(e) {
	return ir[e] || "יחידות זמן";
}
function yr(e) {
	return ar[e] || "ביחס לאירוע המפעיל";
}
function br(e) {
	return {
		scope_and_execution: "היקף וביצוע",
		commencement_and_completion: "תחילה והשלמה",
		stage_acceptance_and_handover: "קבלת שלב ומסירה",
		payment_and_commercial: "תשלום ומסחר",
		notice_and_communication: "הודעות ותקשורת",
		change_and_approval: "שינוי ואישור",
		bond_and_security: "ערבויות ובטוחות",
		warranty_and_defects: "אחריות וליקויים",
		recurring_compliance: "ציות חוזר",
		delay_extension_and_consequence: "עיכוב, הארכה ותוצאה",
		termination_and_remedy: "סיום ותרופה",
		document_and_information_obligation: "מסמכים ומידע",
		other: "אחר"
	}[e] || "קטגוריה לא ידועה";
}
function xr(e) {
	return {
		proposed: "ממתינה לסקירה",
		approved: "אושרה",
		corrected: "תוקנה ואושרה",
		rejected: "נדחתה",
		unresolved: "סומנה כלא פתורה",
		split: "פוצלה",
		merged: "מוזגה",
		superseded: "הוחלפה בגרסה חדשה"
	}[e] || "מצב סקירה לא ידוע";
}
function Sr(e) {
	return {
		yes: "עשויה להשפיע על לוח הזמנים",
		no: "ללא השפעה על לוח הזמנים",
		unknown: "השפעה על לוח הזמנים טרם הוכרעה"
	}[e] || "השפעה לא ידועה";
}
function Cr(e) {
	return {
		none: "ללא כלל זמן",
		fixed: "מועד קבוע",
		relative: "מועד יחסי",
		recurring: "כלל חוזר",
		extension: "הארכת מועד",
		consequence: "תוצאה של איחור"
	}[e] || "סוג זמן לא ידוע";
}
function wr(e) {
	if (!e) return "מועד לא זמין";
	let t = new Date(e);
	return Number.isNaN(t.getTime()) ? "מועד לא זמין" : new Intl.DateTimeFormat("he-IL", {
		dateStyle: "medium",
		timeStyle: "short"
	}).format(t);
}
function W(e) {
	return e?.name === "AbortError" ? "הפעולה חרגה ממגבלת הזמן. אפשר לנסות שוב." : tr[e?.code] || "הפעולה נכשלה. אפשר לנסות שוב או לבדוק את הגדרות השרת.";
}
//#endregion
//#region src/react/ContractsPage.jsx
var Tr = "652bf3e0-9a1e-47ca-b06f-cd8dc33907f7", Er = "81b1cbac-8fcf-43c1-acdc-6b5c809de0e5", Dr = [
	"scope_and_execution",
	"commencement_and_completion",
	"stage_acceptance_and_handover",
	"payment_and_commercial",
	"notice_and_communication",
	"change_and_approval",
	"bond_and_security",
	"warranty_and_defects",
	"recurring_compliance",
	"delay_extension_and_consequence",
	"termination_and_remedy",
	"document_and_information_obligation",
	"other"
], Or = Object.freeze([
	{
		id: "clauses",
		label: "תוכן החוזה",
		description: "סעיפים וחילוץ"
	},
	{
		id: "relationships",
		label: "קשרים בין סעיפים",
		description: "הפניות וקשרים סמנטיים"
	},
	{
		id: "decisions",
		label: "החלטות חוזיות",
		description: "נרמול וסקירה"
	},
	{
		id: "indicator",
		label: "מסירה ל־Indicator",
		description: "ערכת החלטות מאושרת"
	}
]);
function kr({ activeTab: e, onChange: t }) {
	function n(e, n) {
		let r = null;
		if (e.key === "ArrowLeft" && (r = (n + 1) % Or.length), e.key === "ArrowRight" && (r = (n - 1 + Or.length) % Or.length), e.key === "Home" && (r = 0), e.key === "End" && (r = Or.length - 1), r === null) return;
		e.preventDefault();
		let i = Or[r];
		t(i.id), requestAnimationFrame(() => document.getElementById(`contracts-workspace-tab-${i.id}`)?.focus());
	}
	return /* @__PURE__ */ (0, x.jsx)("nav", {
		className: "contractsWorkspaceTabs",
		role: "tablist",
		"aria-label": "שלבי העבודה בחוזה הפתוח",
		children: Or.map((r, i) => /* @__PURE__ */ (0, x.jsxs)("button", {
			id: `contracts-workspace-tab-${r.id}`,
			type: "button",
			role: "tab",
			"aria-selected": e === r.id,
			"aria-controls": `contracts-workspace-panel-${r.id}`,
			className: e === r.id ? "is-active" : "",
			tabIndex: e === r.id ? 0 : -1,
			onClick: () => t(r.id),
			onKeyDown: (e) => n(e, i),
			children: [/* @__PURE__ */ (0, x.jsx)("strong", { children: r.label }), /* @__PURE__ */ (0, x.jsx)("small", { children: r.description })]
		}, r.id))
	});
}
function Ar({ id: e, activeTab: t, children: n }) {
	let r = t === e;
	return /* @__PURE__ */ (0, x.jsx)("div", {
		id: `contracts-workspace-panel-${e}`,
		className: "contractsWorkspaceTabPanel",
		role: "tabpanel",
		"aria-labelledby": `contracts-workspace-tab-${e}`,
		tabIndex: r ? 0 : -1,
		hidden: !r,
		children: n
	});
}
async function G(e, { method: t = "GET", body: n = null, timeoutMs: r = 12e4 } = {}) {
	let i = new AbortController(), a = setTimeout(() => i.abort(), r);
	try {
		let r = await fetch(e, {
			method: t,
			credentials: "same-origin",
			headers: n ? { "Content-Type": "application/json" } : void 0,
			body: n ? JSON.stringify(n) : void 0,
			signal: i.signal
		}), a = await r.json().catch(() => ({}));
		if (!r.ok) {
			let e = Error(a.message || a.error || `HTTP ${r.status}`);
			throw e.code = a.code || (/^[a-z0-9_]+$/u.test(String(a.error || "")) ? a.error : null), e.status = r.status, e;
		}
		return a;
	} finally {
		clearTimeout(a);
	}
}
async function jr(e) {
	let t = new Uint8Array(await e.arrayBuffer()), n = "", r = 32768;
	for (let e = 0; e < t.length; e += r) n += String.fromCharCode(...t.subarray(e, e + r));
	return btoa(n);
}
function Mr(e) {
	return {
		action: "reject",
		reason: "",
		gatesReviewed: !1,
		milestoneKey: e.metadata?.milestoneKey || "",
		approvedBy: "",
		calendarSemantics: "",
		conflictReason: ""
	};
}
function Nr(e) {
	return e.fixedDate ? `מועד קבוע: ${e.fixedDate}` : e.offset ? `${e.offset.value} ${vr(e.offset.unit)} ${yr(e.offset.direction)}` : e.metadata?.extensionAmount ? `הארכה: ${e.metadata.extensionAmount} ${vr(e.metadata.extensionUnit)}` : "ללא ערך זמן סופי";
}
function Pr(e) {
	return [e.pdfPage ? `עמוד ${e.pdfPage}` : null, e.clause ? `סעיף ${e.clause}` : null].filter(Boolean).join(" · ") || "מיקום מקור לא צוין";
}
function Fr(e) {
	return {
		mappingRequirement: "required",
		conditionStatus: e.type === "relative_condition" ? "pending" : "not_applicable",
		triggerEvidenceReviewed: e.type !== "relative_condition",
		preferMilestone: e.storageDisposition === "candidate_for_schedule_contract_milestones",
		activityTerms: [e.action, e.role].filter(Boolean).join("\n"),
		action: "confirm",
		selectedActivityKey: "",
		reason: "",
		conflictResolved: !1,
		supersedesEventId: "",
		reviewRequestId: crypto.randomUUID()
	};
}
function Ir(e, t = null) {
	return {
		decisions: Object.fromEntries((e.candidates || []).map((e) => [e.candidateKey, {
			...Mr(e),
			...t?.decisions?.[e.candidateKey] || {}
		}])),
		reviewReason: t?.reviewReason || "",
		batchId: t?.batchId || `contracts-review-${crypto.randomUUID()}`,
		reviewedAt: t?.reviewedAt || (/* @__PURE__ */ new Date()).toISOString(),
		mappingDraft: t?.mappingDraft || null
	};
}
function Lr({ decisions: e, reviewReason: t, batchId: n, reviewedAt: r, mappingDraft: i }) {
	return {
		decisions: e,
		reviewReason: t,
		batchId: n,
		reviewedAt: r,
		mappingDraft: i
	};
}
function Rr(e) {
	return JSON.stringify(e);
}
function zr(e) {
	let t = Number(e?.revision ?? 0);
	return Number.isSafeInteger(t) && t >= 0 ? t : 0;
}
function Br(e, t, n) {
	return {
		documentVersionId: e.document.documentVersionId,
		candidateKey: t.candidateKey,
		milestoneKey: t.metadata?.milestoneKey || null,
		label: t.action || t.role,
		mappingRequirement: n.mappingRequirement,
		conditionStatus: n.conditionStatus,
		triggerEvidenceReviewed: n.triggerEvidenceReviewed,
		preferMilestone: n.preferMilestone,
		preferredTaskUid: null,
		preferredActivityKey: null,
		preferredOutlineLevel: null,
		activityTerms: n.activityTerms.split(/[\n,]/u).map((e) => e.trim()).filter(Boolean),
		sourceEvidence: (t.sourceEvidence || []).map((e, n) => ({
			evidenceId: `${t.candidateKey}:source:${n + 1}`,
			sourceText: e.sourceText,
			pdfPage: e.pdfPage ?? null,
			clause: e.clause ?? null
		}))
	};
}
function Vr({ extraction: e, sourceProjectId: t, status: n, statusError: r, savedState: i = null, savedStateKey: a = "", onDraftStateChange: o = null }) {
	let [s, c] = (0, b.useState)(""), [l, u] = (0, b.useState)(null), [d, f] = (0, b.useState)(null), [p, m] = (0, b.useState)([]), [h, g] = (0, b.useState)(""), [_, v] = (0, b.useState)(""), [y, S] = (0, b.useState)(""), [C, w] = (0, b.useState)(null), T = (0, b.useRef)(null), E = (e.candidates || []).find((e) => e.candidateKey === s) || null, D = p.filter((e) => e.selectedCanonicalKey);
	(0, b.useEffect)(() => {
		let t = (e.candidates || []).find((e) => e.candidateKey === i?.candidateKey) || null, n = t && i?.draft ? {
			...Fr(t),
			...i.draft
		} : null;
		c(t?.candidateKey || ""), u(n), f(null), m([]), g(""), S(""), w(null);
	}, [
		e.document?.documentVersionId,
		t,
		a
	]);
	function O(e) {
		u((t) => {
			let n = {
				...t,
				...e
			};
			return o?.({
				candidateKey: s,
				draft: n
			}), n;
		}), w(null);
	}
	function k(e) {
		O(e), f(null);
	}
	function A() {
		setTimeout(() => T.current?.scrollIntoView({
			behavior: "smooth",
			block: "center"
		}), 0);
	}
	async function j(n) {
		g("");
		try {
			m((await G(`/api/contracts/activity-mapping/history?${new URLSearchParams({
				sourceProjectId: t,
				documentVersionId: e.document.documentVersionId,
				candidateKey: n.candidateKey,
				limit: "100"
			})}`)).events || []);
		} catch (e) {
			m([]), g(W(e));
		}
	}
	async function M(n) {
		let r = Fr(n);
		c(n.candidateKey), u(r), o?.({
			candidateKey: n.candidateKey,
			draft: r
		}), f(null), m([]), S(""), w(null), v("candidates"), j(n);
		try {
			let i = (await G("/api/contracts/activity-mapping/candidates", {
				method: "POST",
				body: {
					sourceProjectId: t,
					obligation: Br(e, n, r)
				}
			})).candidateBundle, a = i?.candidates?.[0]?.activityKey || "";
			f(i), u((e) => ({
				...e,
				action: a ? "confirm" : "unmapped",
				selectedActivityKey: a
			})), o?.({
				candidateKey: n.candidateKey,
				draft: {
					...r,
					action: a ? "confirm" : "unmapped",
					selectedActivityKey: a
				}
			}), A();
		} catch (e) {
			S(W(e));
		} finally {
			v("");
		}
	}
	async function N() {
		if (!(!E || !l)) {
			v("candidates"), S(""), w(null);
			try {
				let n = (await G("/api/contracts/activity-mapping/candidates", {
					method: "POST",
					body: {
						sourceProjectId: t,
						obligation: Br(e, E, l)
					}
				})).candidateBundle, r = n.candidates.some((e) => e.activityKey === l.selectedActivityKey) ? l.selectedActivityKey : n.candidates[0]?.activityKey || "";
				f(n), u((e) => ({
					...e,
					selectedActivityKey: r,
					action: r ? e.action : "unmapped"
				})), o?.({
					candidateKey: s,
					draft: {
						...l,
						selectedActivityKey: r,
						action: r ? l.action : "unmapped"
					}
				}), A();
			} catch (e) {
				S(W(e));
			} finally {
				v("");
			}
		}
	}
	let ee = !!d?.blockers?.includes("trigger_evidence_unreviewed");
	function P(e) {
		O({
			action: e,
			selectedActivityKey: ["confirm", "correct"].includes(e) && (l.selectedActivityKey || d?.candidates?.[0]?.activityKey) || "",
			supersedesEventId: e === "correct" ? l.supersedesEventId : ""
		});
	}
	function F() {
		return !d || !l ? "יש לטעון חלופות עדכניות לפני שמירת החלטה." : l.reason.trim().length < 10 ? "נדרש נימוק החלטת מיפוי של לפחות 10 תווים." : ["confirm", "correct"].includes(l.action) && !l.selectedActivityKey ? "יש לבחור פעילות מדויקת." : l.action === "correct" && !l.supersedesEventId ? "יש לבחור אירוע קודם שהתיקון מחליף." : d.conflict && !l.conflictResolved && ["confirm", "correct"].includes(l.action) ? "יש לפתור את הסתירה במפורש." : l.action === "reject" && d.candidates.length === 0 ? "כאשר אין חלופות יש לבחור ללא מיפוי, ולא דחייה." : "";
	}
	async function I() {
		let n = F();
		if (n) return S(n);
		v("review"), S(""), w(null);
		try {
			w(await G("/api/contracts/activity-mapping/review", {
				method: "POST",
				body: {
					sourceProjectId: t,
					obligation: Br(e, E, l),
					action: l.action,
					selectedActivityKey: ["confirm", "correct"].includes(l.action) ? l.selectedActivityKey : null,
					reason: l.reason.trim(),
					reviewRequestId: l.reviewRequestId,
					conflictResolved: l.conflictResolved,
					supersedesEventId: l.action === "correct" ? l.supersedesEventId : null
				}
			})), u((e) => {
				let t = {
					...e,
					reviewRequestId: crypto.randomUUID()
				};
				return o?.({
					candidateKey: s,
					draft: t
				}), t;
			}), await j(E);
		} catch (e) {
			S(W(e));
		} finally {
			v("");
		}
	}
	return /* @__PURE__ */ (0, x.jsxs)("section", {
		className: "contractsPanel contractsMappingPanel",
		children: [
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "contractsSectionHeader",
				children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("h2", { children: "4. סקירת קישור לפעילות בלוח" }), /* @__PURE__ */ (0, x.jsx)("p", { children: "המערכת מציגה עד חמש חלופות עדכניות. רק סוקר אנושי יכול לאשר, לדחות, לתקן או להשאיר ללא מיפוי." })] }), /* @__PURE__ */ (0, x.jsx)("span", {
					className: n?.reviewApplyApproved ? "contractsPlanReady" : "contractsPlanBlocked",
					children: n?.reviewApplyApproved ? "כתיבת ביקורת מאושרת" : "כתיבה מושבתת"
				})]
			}),
			(r || !n?.reviewApplyApproved) && /* @__PURE__ */ (0, x.jsx)("p", {
				className: "contractsActivationNotice",
				children: r ? "לא ניתן לטעון את מצב שמירת החלטות המיפוי." : "שער שלב 3F סגור בצד השרת. אפשר לבדוק חלופות והיסטוריה, אך אי אפשר לשמור החלטה."
			}),
			/* @__PURE__ */ (0, x.jsx)("div", {
				className: "contractsMappingCandidates",
				"aria-label": "עובדות חוזיות לקישור",
				children: (e.candidates || []).map((e) => /* @__PURE__ */ (0, x.jsxs)("button", {
					type: "button",
					className: s === e.candidateKey ? "is-selected" : "",
					onClick: () => M(e),
					disabled: !!_,
					children: [
						/* @__PURE__ */ (0, x.jsx)("span", { children: or(e.role) }),
						/* @__PURE__ */ (0, x.jsx)("strong", { children: sr(e) }),
						/* @__PURE__ */ (0, x.jsx)("small", { children: s === e.candidateKey && _ === "candidates" ? "טוען חלופות…" : "בדוק התאמה ללוח" })
					]
				}, e.candidateKey))
			}),
			E && l && /* @__PURE__ */ (0, x.jsxs)("div", {
				className: "contractsMappingWorkspace",
				children: [
					/* @__PURE__ */ (0, x.jsxs)("div", {
						className: "contractsFieldGrid",
						children: [
							/* @__PURE__ */ (0, x.jsxs)("label", { children: ["האם נדרש קישור לפעילות", /* @__PURE__ */ (0, x.jsxs)("select", {
								value: l.mappingRequirement,
								onChange: (e) => k({ mappingRequirement: e.target.value }),
								children: [/* @__PURE__ */ (0, x.jsx)("option", {
									value: "required",
									children: "נדרש"
								}), /* @__PURE__ */ (0, x.jsx)("option", {
									value: "not_required",
									children: "לא נדרש"
								})]
							})] }),
							/* @__PURE__ */ (0, x.jsxs)("label", { children: ["מצב תנאי חוזי", /* @__PURE__ */ (0, x.jsxs)("select", {
								value: l.conditionStatus,
								onChange: (e) => k({ conditionStatus: e.target.value }),
								children: [
									/* @__PURE__ */ (0, x.jsx)("option", {
										value: "not_applicable",
										children: "לא חל"
									}),
									/* @__PURE__ */ (0, x.jsx)("option", {
										value: "pending",
										children: "אירוע מפעיל ממתין לאימות"
									}),
									/* @__PURE__ */ (0, x.jsx)("option", {
										value: "resolved",
										children: "נפתר ונבדק"
									})
								]
							})] }),
							/* @__PURE__ */ (0, x.jsxs)("label", {
								className: "contractsCheck",
								children: [
									/* @__PURE__ */ (0, x.jsx)("input", {
										type: "checkbox",
										checked: l.triggerEvidenceReviewed,
										onChange: (e) => k({ triggerEvidenceReviewed: e.target.checked })
									}),
									"ראיות האירוע המפעיל נבדקו",
									!l.triggerEvidenceReviewed && l.conditionStatus === "pending" && /* @__PURE__ */ (0, x.jsx)("small", { children: "כל עוד תיבה זו אינה מסומנת, המערכת עוצרת לפני חיפוש חלופות ומציגה “טרם בוצע חיפוש”." })
								]
							}),
							/* @__PURE__ */ (0, x.jsxs)("label", {
								className: "contractsCheck",
								children: [/* @__PURE__ */ (0, x.jsx)("input", {
									type: "checkbox",
									checked: l.preferMilestone,
									onChange: (e) => k({ preferMilestone: e.target.checked })
								}), "העדף אבן דרך"]
							})
						]
					}),
					/* @__PURE__ */ (0, x.jsxs)("label", { children: [
						"מונחי מקור להתאמה ללוח, שורה לכל מונח",
						/* @__PURE__ */ (0, x.jsx)("textarea", {
							rows: "3",
							value: l.activityTerms,
							onChange: (e) => k({ activityTerms: e.target.value })
						}),
						/* @__PURE__ */ (0, x.jsx)("small", {
							className: "contractsFieldHint",
							children: "המונחים נשמרים בשפת המקור כדי לא לפגוע בדיוק ההתאמה."
						})
					] }),
					/* @__PURE__ */ (0, x.jsx)("button", {
						type: "button",
						className: "contractsPrimary",
						disabled: !!_,
						onClick: N,
						children: _ === "candidates" ? "טוען מהמקורות המאושרים…" : "רענן חלופות מהלוח הנוכחי"
					}),
					d && /* @__PURE__ */ (0, x.jsxs)(x.Fragment, { children: [
						/* @__PURE__ */ (0, x.jsx)("div", {
							ref: T,
							className: `contractsMappingOutcome ${ee ? "is-blocked" : d.candidates.length ? "is-found" : "is-empty"}`,
							role: "status",
							tabIndex: "-1",
							children: ee ? "החיפוש טרם בוצע: יש לסמן שראיות האירוע המפעיל נבדקו, ואז ללחוץ שוב על רענון החלופות." : d.candidates.length ? `החיפוש הושלם ונמצאו ${d.candidates.length} חלופות פעילות לבדיקה.` : "החיפוש הושלם, אך לא נמצאה פעילות מתאימה בלוח הנוכחי. ניתן לתעד החלטה ללא מיפוי."
						}),
						/* @__PURE__ */ (0, x.jsxs)("div", {
							className: "contractsMappingSummary",
							children: [
								/* @__PURE__ */ (0, x.jsxs)("span", { children: ["מצב ", /* @__PURE__ */ (0, x.jsx)("strong", { children: hr(d.decisionState) })] }),
								/* @__PURE__ */ (0, x.jsxs)("span", { children: ["גרסת לוח ", /* @__PURE__ */ (0, x.jsx)("strong", {
									dir: "ltr",
									children: d.scheduleVersion.fileId
								})] }),
								/* @__PURE__ */ (0, x.jsxs)("span", { children: ["חלופות ", /* @__PURE__ */ (0, x.jsx)("strong", { children: ee ? "טרם בוצע חיפוש" : d.candidates.length })] }),
								/* @__PURE__ */ (0, x.jsxs)("span", { children: ["סתירת גרסה ", /* @__PURE__ */ (0, x.jsx)("strong", { children: d.scheduleVersion.versionConflict ? "כן" : "לא" })] })
							]
						}),
						(d.blockers || []).length > 0 && /* @__PURE__ */ (0, x.jsx)("div", {
							className: "contractsGateList",
							"aria-label": "חסמי מיפוי",
							children: d.blockers.map((e) => /* @__PURE__ */ (0, x.jsx)("span", { children: lr(e) }, e))
						}),
						/* @__PURE__ */ (0, x.jsxs)("div", {
							className: "contractsMappingEvidence",
							children: [/* @__PURE__ */ (0, x.jsx)("strong", { children: "ראיה חוזית מדויקת — הציטוט נשמר בשפת המקור" }), (d.obligation.sourceEvidence || []).map((e) => /* @__PURE__ */ (0, x.jsxs)("blockquote", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: Pr(e) }), /* @__PURE__ */ (0, x.jsx)("p", { children: e.sourceText })] }, e.evidenceId))]
						}),
						/* @__PURE__ */ (0, x.jsxs)("div", {
							className: "contractsAlternativeList",
							"aria-label": "חלופות פעילות",
							children: [d.candidates.map((e) => /* @__PURE__ */ (0, x.jsxs)("label", {
								className: l.selectedActivityKey === e.activityKey ? "is-selected" : "",
								children: [
									/* @__PURE__ */ (0, x.jsx)("input", {
										type: "radio",
										name: "mapping-activity",
										value: e.activityKey,
										checked: l.selectedActivityKey === e.activityKey,
										onChange: () => O({ selectedActivityKey: e.activityKey })
									}),
									/* @__PURE__ */ (0, x.jsxs)("span", {
										className: "contractsAlternativeRank",
										children: ["#", e.rank]
									}),
									/* @__PURE__ */ (0, x.jsxs)("span", { children: [
										/* @__PURE__ */ (0, x.jsxs)("strong", { children: [
											/* @__PURE__ */ (0, x.jsx)("span", {
												className: "contractsSourceLabel",
												children: "שם הפעילות המקורי בלוח:"
											}),
											" ",
											e.taskName
										] }),
										/* @__PURE__ */ (0, x.jsxs)("small", { children: [
											e.plannedStart || "—",
											"–",
											e.plannedFinish || "—",
											" · מזהה משימה ",
											e.taskUid,
											" · רמה ",
											e.outlineLevel
										] }),
										/* @__PURE__ */ (0, x.jsx)("small", {
											dir: "ltr",
											children: e.activityKey
										})
									] }),
									/* @__PURE__ */ (0, x.jsxs)("b", { children: [Math.round(e.confidence * 100), "%"] }),
									/* @__PURE__ */ (0, x.jsxs)("details", { children: [
										/* @__PURE__ */ (0, x.jsx)("summary", { children: "ראיות וחסמים" }),
										(e.evidence || []).map((t, n) => /* @__PURE__ */ (0, x.jsxs)("p", { children: [
											/* @__PURE__ */ (0, x.jsxs)("strong", { children: [_r(t.kind), ":"] }),
											" ",
											/* @__PURE__ */ (0, x.jsx)("span", {
												dir: "auto",
												children: t.detail
											})
										] }, `${e.activityKey}-${n}`)),
										(e.blockers || []).map((e) => /* @__PURE__ */ (0, x.jsx)("p", {
											className: "is-blocker",
											children: lr(e)
										}, e))
									] })
								]
							}, e.activityKey)), d.candidates.length === 0 && /* @__PURE__ */ (0, x.jsx)("p", {
								className: "contractsMappingEmpty",
								children: "לא נמצאו חלופות פעילות. ניתן לתעד החלטה \"ללא מיפוי\" בלבד."
							})]
						}),
						d.conflict && /* @__PURE__ */ (0, x.jsxs)("div", {
							className: "contractsConflictBox",
							children: [
								/* @__PURE__ */ (0, x.jsxs)("strong", { children: ["נמצאה סתירה: ", lr(d.conflict.type)] }),
								/* @__PURE__ */ (0, x.jsx)("p", { children: "אישור אינו אומר שהסעיף תקין; הוא רק בוחר במפורש את הפעילות המתאימה מתוך החלופות הנוכחיות." }),
								/* @__PURE__ */ (0, x.jsxs)("label", {
									className: "contractsCheck",
									children: [/* @__PURE__ */ (0, x.jsx)("input", {
										type: "checkbox",
										checked: l.conflictResolved,
										onChange: (e) => O({ conflictResolved: e.target.checked })
									}), "בדקתי את האירוע המפעיל, הלוח, קישור הפרויקט והסתירה ובחרתי חלופה במפורש"]
								})
							]
						}),
						/* @__PURE__ */ (0, x.jsxs)("div", {
							className: "contractsDecisionRow contractsMappingActions",
							role: "group",
							"aria-label": "החלטת מיפוי",
							children: [
								d.candidates.length > 0 && /* @__PURE__ */ (0, x.jsx)("button", {
									type: "button",
									className: l.action === "confirm" ? "is-selected" : "",
									onClick: () => P("confirm"),
									children: "אשר מיפוי"
								}),
								d.candidates.length > 0 && /* @__PURE__ */ (0, x.jsx)("button", {
									type: "button",
									className: l.action === "reject" ? "is-selected danger" : "",
									onClick: () => P("reject"),
									children: "דחה חלופות"
								}),
								/* @__PURE__ */ (0, x.jsx)("button", {
									type: "button",
									className: l.action === "unmapped" ? "is-selected danger" : "",
									onClick: () => P("unmapped"),
									children: "השאר ללא מיפוי"
								}),
								D.length > 0 && /* @__PURE__ */ (0, x.jsx)("button", {
									type: "button",
									className: l.action === "correct" ? "is-selected" : "",
									onClick: () => P("correct"),
									children: "תקן החלטה קודמת"
								})
							]
						}),
						l.action === "correct" && /* @__PURE__ */ (0, x.jsxs)("label", { children: ["אירוע קודם שהתיקון מחליף", /* @__PURE__ */ (0, x.jsxs)("select", {
							value: l.supersedesEventId,
							onChange: (e) => O({ supersedesEventId: e.target.value }),
							children: [/* @__PURE__ */ (0, x.jsx)("option", {
								value: "",
								children: "בחר אירוע בלתי־ניתן לשינוי"
							}), D.map((e) => /* @__PURE__ */ (0, x.jsxs)("option", {
								value: e.eventId,
								children: [
									mr(e.action),
									" · ",
									wr(e.reviewedAt),
									" · ",
									e.selectedActivityKey || e.selectedCanonicalKey
								]
							}, e.eventId))]
						})] }),
						/* @__PURE__ */ (0, x.jsxs)("label", { children: ["נימוק החלטת מיפוי", /* @__PURE__ */ (0, x.jsx)("textarea", {
							rows: "3",
							value: l.reason,
							onChange: (e) => O({ reason: e.target.value })
						})] }),
						/* @__PURE__ */ (0, x.jsx)("button", {
							type: "button",
							className: "contractsCommit",
							disabled: !!_ || !n?.reviewApplyApproved,
							onClick: I,
							children: _ === "review" ? "שומר אירוע ביקורת אטומי…" : `שמור ${mr(l.action)}`
						})
					] }),
					y && /* @__PURE__ */ (0, x.jsx)("div", {
						className: "contractsMessage is-error",
						role: "alert",
						children: y
					}),
					C && /* @__PURE__ */ (0, x.jsx)("div", {
						className: "contractsMessage is-success",
						children: "החלטת המיפוי נרשמה כאירוע ביקורת בלתי־ניתן לשינוי."
					}),
					/* @__PURE__ */ (0, x.jsxs)("div", {
						className: "contractsHistory",
						children: [
							/* @__PURE__ */ (0, x.jsxs)("div", {
								className: "contractsSectionHeader",
								children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("h3", { children: "היסטוריית החלטות" }), /* @__PURE__ */ (0, x.jsx)("p", { children: "תיקון מוסיף אירוע חדש ומפנה לאירוע הקודם; הוא אינו מוחק היסטוריה." })] }), /* @__PURE__ */ (0, x.jsx)("button", {
									type: "button",
									onClick: () => j(E),
									disabled: !!_,
									children: "רענן היסטוריה"
								})]
							}),
							h && /* @__PURE__ */ (0, x.jsx)("p", {
								className: "contractsActivationNotice",
								children: h
							}),
							!h && p.length === 0 && /* @__PURE__ */ (0, x.jsx)("p", {
								className: "contractsMappingEmpty",
								children: "אין עדיין החלטות שמורות לעובדה זו."
							}),
							p.map((e) => /* @__PURE__ */ (0, x.jsxs)("article", { children: [
								/* @__PURE__ */ (0, x.jsxs)("header", { children: [/* @__PURE__ */ (0, x.jsx)("strong", { children: mr(e.action) }), /* @__PURE__ */ (0, x.jsx)("time", {
									dateTime: e.reviewedAt,
									children: wr(e.reviewedAt)
								})] }),
								/* @__PURE__ */ (0, x.jsx)("p", { children: e.reason }),
								/* @__PURE__ */ (0, x.jsxs)("small", { children: ["סוקר: ", /* @__PURE__ */ (0, x.jsx)("span", {
									dir: "ltr",
									children: e.reviewerId
								})] }),
								e.selectedActivityKey && /* @__PURE__ */ (0, x.jsxs)("small", { children: ["פעילות: ", /* @__PURE__ */ (0, x.jsx)("span", {
									dir: "ltr",
									children: e.selectedActivityKey
								})] }),
								e.supersedesEventId && /* @__PURE__ */ (0, x.jsxs)("small", { children: ["מחליף אירוע: ", /* @__PURE__ */ (0, x.jsx)("span", {
									dir: "ltr",
									children: e.supersedesEventId
								})] })
							] }, e.eventId))
						]
					})
				]
			})
		]
	});
}
function Hr({ extraction: e, decisions: t, reviewReason: n, batchId: r, reviewedAt: i, sourceProjectId: a, scheduleProjectId: o }) {
	return {
		extraction: e,
		reviewBatch: {
			batchId: r,
			reviewedAt: i,
			reason: n.trim(),
			documentAuthority: "authoritative",
			extractorVersion: e.extractorVersion || "contracts-agent.phase1.v1",
			decisions: e.candidates.map((e) => {
				let n = t[e.candidateKey] || Mr(e), r = n.action === "approve";
				return {
					candidateKey: e.candidateKey,
					action: n.action,
					confidence: +!!r,
					resolvedGates: r && n.gatesReviewed ? [...e.gates || []] : [],
					reason: n.reason.trim(),
					...n.milestoneKey.trim() ? { milestoneKey: n.milestoneKey.trim() } : {},
					...n.approvedBy.trim() ? { approvedBy: n.approvedBy.trim() } : {},
					...n.calendarSemantics ? { calendarSemantics: n.calendarSemantics } : {},
					...r && e.conflictGroupId ? { conflictResolution: {
						selectedCandidateKey: e.candidateKey,
						reason: n.conflictReason.trim()
					} } : {}
				};
			})
		},
		projectMapping: {
			sourceProjectId: a.trim(),
			scheduleProjectId: o.trim()
		}
	};
}
function Ur({ candidate: e, decision: t, onChange: n }) {
	let r = t.action === "approve", i = pr(e.storageDisposition), a = e.storageDisposition === "candidate_for_schedule_contract_extensions", o = e.offset?.unit === "day";
	return /* @__PURE__ */ (0, x.jsxs)("article", {
		className: `contractsCandidate ${r ? "is-approved" : "is-rejected"}`,
		children: [
			/* @__PURE__ */ (0, x.jsxs)("header", { children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [
				/* @__PURE__ */ (0, x.jsx)("span", {
					className: "contractsCandidateRole",
					children: or(e.role)
				}),
				/* @__PURE__ */ (0, x.jsx)("h3", { children: sr(e) }),
				/* @__PURE__ */ (0, x.jsx)("p", { children: Nr(e) })
			] }), /* @__PURE__ */ (0, x.jsx)("span", {
				className: "contractsTarget",
				children: i
			})] }),
			/* @__PURE__ */ (0, x.jsx)("div", {
				className: "contractsEvidenceList",
				children: (e.sourceEvidence || []).map((t, n) => /* @__PURE__ */ (0, x.jsxs)("blockquote", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: Pr(t) }), /* @__PURE__ */ (0, x.jsx)("p", { children: t.sourceText })] }, `${e.candidateKey}-evidence-${n}`))
			}),
			(e.gates || []).length > 0 && /* @__PURE__ */ (0, x.jsx)("div", {
				className: "contractsGateList",
				"aria-label": "חסמי קידום",
				children: (e.gates || []).map((e) => /* @__PURE__ */ (0, x.jsx)("span", { children: cr(e) }, e))
			}),
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "contractsDecisionRow",
				role: "group",
				"aria-label": "החלטת סוקר",
				children: [/* @__PURE__ */ (0, x.jsx)("button", {
					type: "button",
					className: r ? "is-selected" : "",
					onClick: () => n({ action: "approve" }),
					children: "אשר לקידום"
				}), /* @__PURE__ */ (0, x.jsx)("button", {
					type: "button",
					className: r ? "" : "is-selected danger",
					onClick: () => n({ action: "reject" }),
					children: "דחה"
				})]
			}),
			r && /* @__PURE__ */ (0, x.jsxs)("label", {
				className: "contractsCheck",
				children: [/* @__PURE__ */ (0, x.jsx)("input", {
					type: "checkbox",
					checked: t.gatesReviewed,
					onChange: (e) => n({ gatesReviewed: e.target.checked })
				}), "בדקתי את הראיות ופתרתי במפורש את כל החסמים המוצגים"]
			}),
			r && e.storageDisposition === "candidate_for_schedule_contract_milestones" && /* @__PURE__ */ (0, x.jsxs)("label", { children: ["מפתח אבן דרך", /* @__PURE__ */ (0, x.jsx)("input", {
				value: t.milestoneKey,
				onChange: (e) => n({ milestoneKey: e.target.value }),
				placeholder: e.candidateKey
			})] }),
			r && a && /* @__PURE__ */ (0, x.jsxs)("div", {
				className: "contractsFieldGrid",
				children: [/* @__PURE__ */ (0, x.jsxs)("label", { children: ["מפתח אבן הדרך שמקבלת את ההארכה", /* @__PURE__ */ (0, x.jsx)("input", {
					value: t.milestoneKey,
					onChange: (e) => n({ milestoneKey: e.target.value })
				})] }), /* @__PURE__ */ (0, x.jsxs)("label", { children: ["מאשר ההארכה", /* @__PURE__ */ (0, x.jsx)("input", {
					value: t.approvedBy,
					onChange: (e) => n({ approvedBy: e.target.value })
				})] })]
			}),
			r && o && /* @__PURE__ */ (0, x.jsxs)("label", { children: ["משמעות \"יום\" שאושרה", /* @__PURE__ */ (0, x.jsxs)("select", {
				value: t.calendarSemantics,
				onChange: (e) => n({ calendarSemantics: e.target.value }),
				children: [/* @__PURE__ */ (0, x.jsx)("option", {
					value: "",
					children: "לא נבחר"
				}), /* @__PURE__ */ (0, x.jsx)("option", {
					value: "calendar_days",
					children: "ימים קלנדריים"
				})]
			})] }),
			r && e.conflictGroupId && /* @__PURE__ */ (0, x.jsxs)("label", { children: ["נימוק לבחירת מועמד זה מתוך הסתירה", /* @__PURE__ */ (0, x.jsx)("textarea", {
				value: t.conflictReason,
				onChange: (e) => n({ conflictReason: e.target.value }),
				rows: "2"
			})] }),
			/* @__PURE__ */ (0, x.jsxs)("label", { children: ["נימוק החלטה", /* @__PURE__ */ (0, x.jsx)("textarea", {
				value: t.reason,
				onChange: (e) => n({ reason: e.target.value }),
				rows: "2"
			})] })
		]
	});
}
function Wr({ preview: e, classicDocumentVersionId: t = "" }) {
	let [n, r] = (0, b.useState)(""), [i, a] = (0, b.useState)("operative"), [o, s] = (0, b.useState)("all"), [c, l] = (0, b.useState)("all"), [u, d] = (0, b.useState)(!1), f = (0, b.useMemo)(() => Fn(e), [e]), p = f.clauses || [], m = (0, b.useMemo)(() => [...new Set(p.map((e) => e.clauseType))].sort(), [p]), h = (0, b.useMemo)(() => [...new Set(p.flatMap((e) => e.hashtags || []))].sort(), [p]), g = (0, b.useMemo)(() => new Map(p.map((e) => [e.clauseKey, e])), [p]), _ = n.trim().toLocaleLowerCase("he"), v = (0, b.useMemo)(() => p.filter((e) => i !== "all" && e.structuralRole !== i || o !== "all" && e.clauseType !== o || c !== "all" && !(e.hashtags || []).includes(c) || u && !(e.crossReferences || []).length ? !1 : _ ? [
		e.clauseKey,
		e.parentClauseKey,
		e.clauseTitle,
		e.summaryHe,
		e.rawText,
		e.displayLabelHe,
		e.structuralRoleLabelHe,
		...e.hashtags || [],
		...e.tagLabelsHe || []
	].filter(Boolean).join(" ").toLocaleLowerCase("he").includes(_) : !0), [
		p,
		_,
		u,
		i,
		c,
		o
	]), y = (0, b.useMemo)(() => {
		let e = [], t = /* @__PURE__ */ new Set();
		for (let n of v) {
			let r = g.get(n.parentClauseKey), i = n.structuralRole === "heading" ? n : r?.structuralRole === "heading" ? r : null;
			i && !t.has(i.clauseKey) && (e.push({
				kind: "heading",
				clause: i
			}), t.add(i.clauseKey)), n.structuralRole !== "heading" && e.push({
				kind: "record",
				clause: n
			});
		}
		return e;
	}, [g, v]), S = t ? t === f.document.documentVersionId ? "same-document" : "different-document" : "classic-missing";
	return /* @__PURE__ */ (0, x.jsxs)("section", {
		className: "contractsPanel contractsClausePreviewPanel",
		"aria-labelledby": "contracts-clause-preview-title",
		children: [
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "contractsSectionHeader",
				children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [
					/* @__PURE__ */ (0, x.jsxs)("p", {
						className: "contractsEyebrow",
						children: ["סוכן החוזים · ", f.persisted ? "חילוץ שמור R3.2" : "תצוגת אימות R3.1"]
					}),
					/* @__PURE__ */ (0, x.jsx)("h2", {
						id: "contracts-clause-preview-title",
						children: "2. תוכן החוזה שחולץ"
					}),
					/* @__PURE__ */ (0, x.jsxs)("p", { children: [
						f.document.filename,
						" · ",
						f.document.pageCount,
						" עמודים · ",
						p.length,
						" רשומות מסמך · ",
						f.coverage.operativeCount,
						" הוראות חוזיות"
					] })
				] }), /* @__PURE__ */ (0, x.jsxs)("div", {
					className: "contractsWorkspaceSaveState",
					children: [/* @__PURE__ */ (0, x.jsx)("span", {
						className: "contractsPlanReady",
						children: "כיסוי מקור מלא"
					}), /* @__PURE__ */ (0, x.jsx)("span", {
						className: "contractsDryBadge",
						children: f.persisted ? "נשמר ב־KAPAIM · פתיחה ללא חילוץ חוזר" : "תצוגה מקומית · לא נשמר"
					})]
				})]
			}),
			/* @__PURE__ */ (0, x.jsx)("div", {
				className: `contractsComparisonNotice is-${S}`,
				role: "status",
				children: S === "same-document" ? "תוצאת החילוץ הקלאסי שייכת לאותה גרסת PDF — אפשר להשוות בין שתי התוצאות במסך זה." : S === "different-document" ? "תוצאת החילוץ הקלאסי הפתוחה שייכת לגרסת PDF אחרת. יש להריץ אותה מחדש על הקובץ הנבחר לפני ההשוואה." : "כדי להשוות, אפשר להריץ גם את החילוץ הקלאסי באמצעות הכפתור שבאזור העלאת הקובץ."
			}),
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "contractsClauseMetrics",
				"aria-label": "מדדי שלמות החילוץ",
				children: [
					/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "שורות מקור" }), /* @__PURE__ */ (0, x.jsxs)("strong", { children: [
						f.coverage.accountedSourceLineCount,
						"/",
						f.coverage.sourceLineCount
					] })] }),
					/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "יחידות ממוספרות" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: f.coverage.numberedSourceCount })] }),
					/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "הוראות חוזיות" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: f.coverage.operativeCount })] }),
					/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "כותרות מבניות" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: f.coverage.headingCount })] }),
					/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "הגדרות חוזיות" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: f.coverage.definitionCount })] }),
					/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "רשומות הקשר" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: f.coverage.contextCount })] }),
					/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "הפניות שזוהו" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: f.quality.referenceCount })] }),
					/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "שגיאות כיסוי" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: f.coverage.errorCount })] })
				]
			}),
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "contractsClauseFilters",
				children: [
					/* @__PURE__ */ (0, x.jsxs)("label", { children: ["חיפוש בכל הסעיפים", /* @__PURE__ */ (0, x.jsx)("input", {
						type: "search",
						value: n,
						onChange: (e) => r(e.target.value),
						placeholder: "מספר סעיף, מילה, תקציר או תגית"
					})] }),
					/* @__PURE__ */ (0, x.jsxs)("label", { children: ["תצוגה", /* @__PURE__ */ (0, x.jsxs)("select", {
						value: i,
						onChange: (e) => a(e.target.value),
						children: [
							/* @__PURE__ */ (0, x.jsx)("option", {
								value: "operative",
								children: "הוראות חוזיות בלבד"
							}),
							/* @__PURE__ */ (0, x.jsx)("option", {
								value: "all",
								children: "כל רשומות המסמך"
							}),
							/* @__PURE__ */ (0, x.jsx)("option", {
								value: "heading",
								children: "כותרות ומבנה"
							}),
							/* @__PURE__ */ (0, x.jsx)("option", {
								value: "definition",
								children: "הגדרות חוזיות"
							}),
							/* @__PURE__ */ (0, x.jsx)("option", {
								value: "context",
								children: "הקשר מסמך"
							})
						]
					})] }),
					/* @__PURE__ */ (0, x.jsxs)("label", { children: ["סוג רשומה", /* @__PURE__ */ (0, x.jsxs)("select", {
						value: o,
						onChange: (e) => s(e.target.value),
						children: [/* @__PURE__ */ (0, x.jsx)("option", {
							value: "all",
							children: "כל הסוגים"
						}), m.map((e) => /* @__PURE__ */ (0, x.jsx)("option", {
							value: e,
							children: kn(e)
						}, e))]
					})] }),
					/* @__PURE__ */ (0, x.jsxs)("label", { children: ["תגית", /* @__PURE__ */ (0, x.jsxs)("select", {
						value: c,
						onChange: (e) => l(e.target.value),
						children: [/* @__PURE__ */ (0, x.jsx)("option", {
							value: "all",
							children: "כל התגיות"
						}), h.map((e) => /* @__PURE__ */ (0, x.jsx)("option", {
							value: e,
							children: jn(e)
						}, e))]
					})] }),
					/* @__PURE__ */ (0, x.jsxs)("label", {
						className: "contractsCheck contractsClauseReferenceFilter",
						children: [/* @__PURE__ */ (0, x.jsx)("input", {
							type: "checkbox",
							checked: u,
							onChange: (e) => d(e.target.checked)
						}), "רק סעיפים עם הפניות"]
					})
				]
			}),
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "contractsClauseResultBar",
				children: [
					/* @__PURE__ */ (0, x.jsx)("strong", { children: v.length }),
					" מתוך ",
					p.length,
					" רשומות מוצגות",
					(n || i !== "operative" || o !== "all" || c !== "all" || u) && /* @__PURE__ */ (0, x.jsx)("button", {
						type: "button",
						onClick: () => {
							r(""), a("operative"), s("all"), l("all"), d(!1);
						},
						children: "נקה סינון"
					})
				]
			}),
			/* @__PURE__ */ (0, x.jsx)("div", {
				className: "contractsClauseList",
				children: y.map((e) => e.kind === "heading" ? /* @__PURE__ */ (0, x.jsxs)("section", {
					className: "contractsClauseHeading",
					"aria-label": e.clause.displayLabelHe,
					children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("bdi", {
						dir: "ltr",
						children: e.clause.clauseKey.replace(/\.heading$/u, "")
					}), /* @__PURE__ */ (0, x.jsxs)("span", {
						className: "contractsClauseHeadingText",
						children: [/* @__PURE__ */ (0, x.jsx)("h3", { children: e.clause.clauseTitle || e.clause.displayLabelHe }), e.clause.structuralLeadHe && /* @__PURE__ */ (0, x.jsxs)("p", { children: ["פתיח הסעיף: ", e.clause.structuralLeadHe] })]
					})] }), /* @__PURE__ */ (0, x.jsxs)("span", { children: [e.clause.childCount, " רשומות תחת כותרת זו"] })]
				}, `heading-${e.clause.clauseKey}`) : /* @__PURE__ */ (0, x.jsxs)("details", {
					className: `contractsClauseCard is-${e.clause.structuralRole}`,
					children: [/* @__PURE__ */ (0, x.jsxs)("summary", { children: [
						/* @__PURE__ */ (0, x.jsxs)("span", {
							className: "contractsClauseIdentity",
							children: [/* @__PURE__ */ (0, x.jsx)("bdi", {
								dir: "ltr",
								children: e.clause.clauseKey
							}), /* @__PURE__ */ (0, x.jsxs)("small", { children: [
								e.clause.structuralRoleLabelHe,
								" · ",
								e.clause.pageStart === e.clause.pageEnd ? `עמוד ${e.clause.pageStart}` : `עמודים ${e.clause.pageStart}–${e.clause.pageEnd}`
							] })]
						}),
						/* @__PURE__ */ (0, x.jsx)("span", {
							className: "contractsClauseSummary",
							children: e.clause.summaryHe
						}),
						/* @__PURE__ */ (0, x.jsx)("span", {
							className: "contractsClauseTags",
							children: (e.clause.hashtags || []).map((e) => /* @__PURE__ */ (0, x.jsx)("i", { children: jn(e) }, e))
						})
					] }), /* @__PURE__ */ (0, x.jsxs)("div", {
						className: "contractsClauseBody",
						children: [
							/* @__PURE__ */ (0, x.jsxs)("div", {
								className: "contractsClauseSource",
								children: [/* @__PURE__ */ (0, x.jsx)("strong", { children: "הטקסט המקורי" }), /* @__PURE__ */ (0, x.jsx)("p", { children: e.clause.rawText })]
							}),
							/* @__PURE__ */ (0, x.jsxs)("div", {
								className: "contractsClauseEnrichment",
								children: [
									/* @__PURE__ */ (0, x.jsx)("strong", { children: "תוצאת סוכן החוזים" }),
									/* @__PURE__ */ (0, x.jsx)("p", { children: e.clause.summaryHe }),
									/* @__PURE__ */ (0, x.jsxs)("small", { children: ["סיווג: ", An(e.clause.structuralRole)] })
								]
							}),
							(e.clause.crossReferences || []).length > 0 && /* @__PURE__ */ (0, x.jsxs)("div", {
								className: "contractsClauseReferences",
								children: [/* @__PURE__ */ (0, x.jsx)("strong", { children: "הפניות מפורשות שנמצאו" }), /* @__PURE__ */ (0, x.jsx)("ul", { children: e.clause.crossReferences.map((e, t) => /* @__PURE__ */ (0, x.jsxs)("li", { children: [
									"“",
									e.referenceText,
									"” ← ",
									e.targetLabelHe,
									/* @__PURE__ */ (0, x.jsx)("span", {
										className: e.resolution === "resolved" ? "is-resolved" : "is-unresolved",
										children: e.resolution === "resolved" ? "נמצא יעד" : "היעד חסר במסמך"
									})
								] }, `${e.referenceText}-${e.targetClauseKey}-${t}`)) })]
							}),
							/* @__PURE__ */ (0, x.jsxs)("details", {
								className: "contractsClauseTechnical contractsClauseRecordTechnical",
								children: [
									/* @__PURE__ */ (0, x.jsx)("summary", { children: "פרטים טכניים של הרשומה" }),
									/* @__PURE__ */ (0, x.jsxs)("div", {
										className: "contractsClauseSearchContent",
										children: [/* @__PURE__ */ (0, x.jsx)("strong", { children: "תוכן החיפוש בעברית" }), /* @__PURE__ */ (0, x.jsx)("p", { children: e.clause.displayContentHe })]
									}),
									/* @__PURE__ */ (0, x.jsxs)("small", { children: ["סטטוס עיבוד: ", e.clause.processingStatus === "processed" ? "עובד ואומת" : e.clause.processingStatus] }),
									e.clause.parentClauseKey && /* @__PURE__ */ (0, x.jsxs)("small", { children: ["מזהה רשומת אב: ", /* @__PURE__ */ (0, x.jsx)("bdi", {
										dir: "ltr",
										children: e.clause.parentClauseKey
									})] }),
									(e.clause.crossReferences || []).map((e, t) => /* @__PURE__ */ (0, x.jsxs)("small", { children: ["מזהה יעד: ", /* @__PURE__ */ (0, x.jsx)("bdi", {
										dir: "ltr",
										children: e.targetClauseKey
									})] }, `technical-reference-${t}`)),
									/* @__PURE__ */ (0, x.jsxs)("footer", { children: [/* @__PURE__ */ (0, x.jsxs)("code", {
										dir: "ltr",
										children: ["מקור ", e.clause.rawTextSha256]
									}), /* @__PURE__ */ (0, x.jsxs)("code", {
										dir: "ltr",
										children: ["תוכן ", e.clause.contentSha256]
									})] })
								]
							})
						]
					})]
				}, e.clause.clauseKey))
			}),
			/* @__PURE__ */ (0, x.jsxs)("details", {
				className: "contractsClauseTechnical",
				children: [
					/* @__PURE__ */ (0, x.jsx)("summary", { children: "פרטי גרסאות טכניים" }),
					/* @__PURE__ */ (0, x.jsx)("code", {
						dir: "ltr",
						children: f.presentationVersion
					}),
					/* @__PURE__ */ (0, x.jsx)("code", {
						dir: "ltr",
						children: f.generations.parserGenerationId
					}),
					/* @__PURE__ */ (0, x.jsx)("code", {
						dir: "ltr",
						children: f.generations.enrichmentGenerationId
					}),
					/* @__PURE__ */ (0, x.jsx)("code", {
						dir: "ltr",
						children: f.generations.modelVersion
					})
				]
			})
		]
	});
}
function Gr(e) {
	let t = Number(e || 0);
	return t >= .97 ? "גבוה מאוד" : t >= .9 ? "גבוה" : "בינוני";
}
var Kr = Object.freeze([
	"supports_same_decision",
	"depends_on",
	"condition_of",
	"exception_to",
	"amends",
	"duplicates",
	"conflicts_with"
]);
function qr({ item: e, busy: t = !1, onReview: n }) {
	let [r, i] = (0, b.useState)(""), [a, o] = (0, b.useState)(e.relationshipType), [s, c] = (0, b.useState)(!1), l = e.reviewStatus === "proposed", u = r.trim().length >= 10 && /[\u0590-\u05ff]/u.test(r), d = ["duplicates", "conflicts_with"].includes(a), f = a !== e.relationshipType || !d && s, p = s && !d ? e.targetClauseKey : e.sourceClauseKey, m = s && !d ? e.sourceClauseKey : e.targetClauseKey, h = Array.isArray(e.evidence?.excerpts) ? e.evidence.excerpts : [], g = e.evidence?.signals?.autoReview, _ = g?.mode === "model_auto_approval";
	function v(t) {
		let i = { reasonHe: r.trim() };
		t === "correct" && (i.correction = {
			relationshipType: a,
			sourceClauseKey: p,
			targetClauseKey: m
		}), n(e, t, i);
	}
	return /* @__PURE__ */ (0, x.jsxs)("article", {
		className: `contractsRelationshipCard is-semantic is-review-${e.reviewStatus}`,
		children: [
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "contractsRelationshipRoute",
				children: [
					/* @__PURE__ */ (0, x.jsxs)("span", { children: [
						/* @__PURE__ */ (0, x.jsxs)("small", { children: ["סעיף מקור · עמודים ", e.sourcePageStart === e.sourcePageEnd ? e.sourcePageStart : `${e.sourcePageStart}–${e.sourcePageEnd}`] }),
						/* @__PURE__ */ (0, x.jsx)("strong", { children: /* @__PURE__ */ (0, x.jsx)("bdi", {
							dir: "ltr",
							children: e.sourceClauseKey
						}) }),
						/* @__PURE__ */ (0, x.jsx)("p", { children: e.sourceSummaryHe })
					] }),
					/* @__PURE__ */ (0, x.jsx)("b", {
						className: "contractsRelationshipArrow",
						"aria-label": "קשור אל",
						children: "←"
					}),
					/* @__PURE__ */ (0, x.jsxs)("span", { children: [
						/* @__PURE__ */ (0, x.jsxs)("small", { children: ["סעיף יעד · עמודים ", e.targetPageStart === e.targetPageEnd ? e.targetPageStart : `${e.targetPageStart}–${e.targetPageEnd}`] }),
						/* @__PURE__ */ (0, x.jsx)("strong", { children: /* @__PURE__ */ (0, x.jsx)("bdi", {
							dir: "ltr",
							children: e.targetClauseKey
						}) }),
						/* @__PURE__ */ (0, x.jsx)("p", { children: e.targetSummaryHe })
					] })
				]
			}),
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "contractsRelationshipMeta",
				children: [
					/* @__PURE__ */ (0, x.jsx)("i", { children: Gn(e.relationshipType) }),
					/* @__PURE__ */ (0, x.jsx)("i", { children: Kn(e.origin) }),
					/* @__PURE__ */ (0, x.jsx)("i", { children: qn(e.reviewStatus) }),
					_ && /* @__PURE__ */ (0, x.jsx)("i", {
						title: `מדיניות: ${g.policyVersion}`,
						children: "אושר אוטומטית בידי המודל"
					}),
					e.confidence !== null && e.confidence !== void 0 && /* @__PURE__ */ (0, x.jsxs)("i", {
						title: "ביטחון הסיווג של המודל; אינו ודאות משפטית",
						children: ["ביטחון סיווג: ", Gr(e.confidence)]
					}),
					/* @__PURE__ */ (0, x.jsxs)("span", { children: ["גרסה ", e.revision] })
				]
			}),
			/* @__PURE__ */ (0, x.jsx)("p", {
				className: "contractsRelationshipRationale",
				children: e.evidence?.rationaleHe
			}),
			/* @__PURE__ */ (0, x.jsxs)("details", {
				className: "contractsRelationshipEvidence",
				children: [/* @__PURE__ */ (0, x.jsx)("summary", { children: "הצג את שתי הראיות המקוריות" }), /* @__PURE__ */ (0, x.jsx)("div", { children: h.map((e, t) => /* @__PURE__ */ (0, x.jsx)("blockquote", { children: e.excerpt }, e.clauseId || t)) })]
			}),
			l ? /* @__PURE__ */ (0, x.jsxs)("div", {
				className: "contractsRelationshipReviewForm",
				children: [
					/* @__PURE__ */ (0, x.jsxs)("label", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "נימוק סקירה בעברית — לפחות 10 תווים" }), /* @__PURE__ */ (0, x.jsx)("textarea", {
						rows: "2",
						value: r,
						onChange: (e) => i(e.target.value),
						placeholder: "לדוגמה: שתי הראיות מתארות את אותו קנס יומי בסכומים סותרים.",
						disabled: t
					})] }),
					/* @__PURE__ */ (0, x.jsxs)("div", {
						className: "contractsRelationshipReviewActions",
						children: [/* @__PURE__ */ (0, x.jsx)("button", {
							type: "button",
							className: "contractsPrimary",
							disabled: !u || t,
							onClick: () => v("approve"),
							children: "אשר קשר"
						}), /* @__PURE__ */ (0, x.jsx)("button", {
							type: "button",
							disabled: !u || t,
							onClick: () => v("reject"),
							children: "דחה קשר"
						})]
					}),
					/* @__PURE__ */ (0, x.jsxs)("details", {
						className: "contractsRelationshipCorrection",
						children: [/* @__PURE__ */ (0, x.jsx)("summary", { children: "תקן סוג קשר או כיוון" }), /* @__PURE__ */ (0, x.jsxs)("div", { children: [
							/* @__PURE__ */ (0, x.jsxs)("label", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "סוג הקשר המתוקן" }), /* @__PURE__ */ (0, x.jsx)("select", {
								value: a,
								onChange: (e) => o(e.target.value),
								disabled: t,
								children: Kr.map((e) => /* @__PURE__ */ (0, x.jsx)("option", {
									value: e,
									children: Gn(e)
								}, e))
							})] }),
							/* @__PURE__ */ (0, x.jsxs)("label", {
								className: "contractsRelationshipDirectionToggle",
								children: [/* @__PURE__ */ (0, x.jsx)("input", {
									type: "checkbox",
									checked: s && !d,
									onChange: (e) => c(e.target.checked),
									disabled: t || d
								}), /* @__PURE__ */ (0, x.jsxs)("span", { children: [
									"הפוך כיוון: ",
									/* @__PURE__ */ (0, x.jsx)("bdi", {
										dir: "ltr",
										children: e.targetClauseKey
									}),
									" ← ",
									/* @__PURE__ */ (0, x.jsx)("bdi", {
										dir: "ltr",
										children: e.sourceClauseKey
									})
								] })]
							}),
							d && /* @__PURE__ */ (0, x.jsx)("small", { children: "בקשר סימטרי אין משמעות לכיוון; נקודות הקצה נשמרות בסדר קבוע." }),
							/* @__PURE__ */ (0, x.jsx)("button", {
								type: "button",
								className: "contractsPrimary",
								disabled: !u || !f || t,
								onClick: () => v("correct"),
								children: "שמור תיקון ואשר"
							})
						] })]
					})
				]
			}) : /* @__PURE__ */ (0, x.jsxs)("div", {
				className: "contractsRelationshipReviewedState",
				role: "status",
				children: [
					/* @__PURE__ */ (0, x.jsx)("strong", { children: qn(e.reviewStatus) }),
					_ && /* @__PURE__ */ (0, x.jsx)("p", { children: "האישור בוצע אוטומטית לאחר הסכמה בין המסווג לבודק העצמאי ועמידה בכללי הבטיחות." }),
					e.reviewReason && /* @__PURE__ */ (0, x.jsx)("p", { children: e.reviewReason }),
					e.reviewedAt && /* @__PURE__ */ (0, x.jsx)("time", {
						dateTime: e.reviewedAt,
						children: wr(e.reviewedAt)
					})
				]
			})
		]
	});
}
function Jr({ preview: e, workspaceId: t = "", persistenceStatus: n = null, persistenceResult: r = null, persistenceError: i = "", persistenceBusy: a = !1, onPersist: o, semanticStatus: s = null, semanticResult: c = null, semanticError: l = "", semanticBusy: u = !1, onRunSemantic: d, reviewStatus: f = null, reviewResult: p = null, reviewError: m = "", reviewBusyId: h = "", onReview: g, autoReviewStatus: _ = null, autoReviewResult: v = null, autoReviewError: y = "", autoReviewBusy: S = !1, onAutoReview: C }) {
	let w = (0, b.useMemo)(() => Jn(e), [e]), T = Number(r?.metrics?.explicitRelationshipCount || 0), E = Number(p?.metrics?.currentRelationshipCount || 0), D = Number(p?.metrics?.proposedCount || 0), O = !!(n?.ready && t && !a && !u), k = !!(s?.ready && t && !u && !a), A = !!(_?.ready && D > 0 && !S && !u && !a), j = T === w.metrics.explicitRelationshipCount && w.metrics.explicitRelationshipCount > 0, M = Number(c?.metrics?.classificationFailedPairCount || 0), N = Number(c?.metrics?.verificationFailedPairCount || 0), ee = c?.metrics?.classificationComplete !== !1 && c?.metrics?.verificationComplete !== !1;
	return /* @__PURE__ */ (0, x.jsxs)("section", {
		className: "contractsPanel contractsRelationshipsPanel",
		"aria-labelledby": "contracts-relationships-title",
		children: [
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "contractsSectionHeader",
				children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [
					/* @__PURE__ */ (0, x.jsx)("p", {
						className: "contractsEyebrow",
						children: "סוכן הקשרים בחוזים · R4.0 + R4.1 + R4.2A"
					}),
					/* @__PURE__ */ (0, x.jsx)("h2", {
						id: "contracts-relationships-title",
						children: "3. קשרים בין סעיפי החוזה"
					}),
					/* @__PURE__ */ (0, x.jsx)("p", { children: "הפניות מפורשות נשמרות בנפרד; קשרים סמנטיים נשמרים כהצעות וממתינים להחלטת סוקר." })
				] }), /* @__PURE__ */ (0, x.jsxs)("div", {
					className: "contractsWorkspaceSaveState",
					role: "status",
					children: [/* @__PURE__ */ (0, x.jsx)("span", {
						className: j ? "contractsPlanReady" : "contractsDryBadge",
						children: j ? `נשמרו ${T} הצעות קשר ב־KAPAIM` : "תצוגה דטרמיניסטית לפני שמירה"
					}), /* @__PURE__ */ (0, x.jsx)("span", {
						className: "contractsDryBadge",
						children: "ללא החלטות חוזיות · ללא כתיבה ללוח הזמנים"
					})]
				})]
			}),
			/* @__PURE__ */ (0, x.jsx)("div", {
				className: "contractsRelationshipBoundary",
				role: "note",
				children: "הפניה מפורשת מוכיחה שסעיף אחד מפנה לסעיף אחר. היא אינה מוכיחה לבדה ששני הסעיפים שייכים לאותה החלטה, תלויים זה בזה או סותרים זה את זה."
			}),
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "contractsClauseMetrics",
				"aria-label": "מדדי סוכן הקשרים",
				children: [
					/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "הפניות מפורשות שנמצאו" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: w.metrics.explicitReferenceCount })] }),
					/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "הצעות קשר ישירות" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: w.metrics.explicitRelationshipCount })] }),
					/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "הפניות ללא יעד" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: w.metrics.unresolvedReferenceCount })] }),
					/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "קשרים שהוצעו בידי מודל" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: w.metrics.modelRelationshipCount })] }),
					/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "החלטות חוזיות שנוצרו" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: w.metrics.decisionCount })] }),
					/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "כתיבות ללוח הזמנים" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: w.metrics.scheduleWriteCount })] })
				]
			}),
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "contractsRelationshipActions",
				children: [/* @__PURE__ */ (0, x.jsx)("button", {
					type: "button",
					className: "contractsPrimary",
					disabled: !O,
					onClick: o,
					children: a ? "שומר הצעות קשר מפורשות…" : j ? "בדוק ושמור שוב ללא כפילויות" : "שמור את הצעות הקשר המפורשות"
				}), /* @__PURE__ */ (0, x.jsx)("p", { children: t ? n?.ready ? "השמירה אטומית וחוזרת משתמשת באותן רשומות במקום ליצור כפילויות." : "מיגרציית R4.0 והפעלת השרת עדיין נדרשות לפני שמירה; התצוגה המקומית כבר זמינה לבדיקה." : "שמירת קשרים זמינה רק לאחר פתיחת חילוץ סעיפים שמור." })]
			}),
			n?.ready && i && /* @__PURE__ */ (0, x.jsx)("div", {
				className: "contractsMessage is-error",
				role: "alert",
				children: i
			}),
			/* @__PURE__ */ (0, x.jsx)("div", {
				className: "contractsRelationshipList",
				children: w.proposals.map((e) => /* @__PURE__ */ (0, x.jsxs)("article", {
					className: "contractsRelationshipCard",
					children: [
						/* @__PURE__ */ (0, x.jsxs)("div", {
							className: "contractsRelationshipRoute",
							children: [
								/* @__PURE__ */ (0, x.jsxs)("span", { children: [
									/* @__PURE__ */ (0, x.jsx)("small", { children: "סעיף מפנה" }),
									/* @__PURE__ */ (0, x.jsxs)("strong", { children: [
										/* @__PURE__ */ (0, x.jsx)("bdi", {
											dir: "ltr",
											children: e.sourceClauseKey
										}),
										" · ",
										e.sourceLabelHe
									] }),
									/* @__PURE__ */ (0, x.jsx)("p", { children: e.sourceSummaryHe })
								] }),
								/* @__PURE__ */ (0, x.jsx)("b", {
									className: "contractsRelationshipArrow",
									"aria-label": "מפנה אל",
									children: "←"
								}),
								/* @__PURE__ */ (0, x.jsxs)("span", { children: [
									/* @__PURE__ */ (0, x.jsx)("small", { children: "סעיף יעד" }),
									/* @__PURE__ */ (0, x.jsxs)("strong", { children: [
										/* @__PURE__ */ (0, x.jsx)("bdi", {
											dir: "ltr",
											children: e.targetClauseKey
										}),
										" · ",
										e.targetLabelHe
									] }),
									/* @__PURE__ */ (0, x.jsx)("p", { children: e.targetSummaryHe })
								] })
							]
						}),
						/* @__PURE__ */ (0, x.jsxs)("div", {
							className: "contractsRelationshipMeta",
							children: [
								/* @__PURE__ */ (0, x.jsx)("i", { children: Gn(e.relationshipType) }),
								/* @__PURE__ */ (0, x.jsx)("i", { children: Kn(e.origin) }),
								/* @__PURE__ */ (0, x.jsx)("i", { children: qn(e.reviewStatus) }),
								/* @__PURE__ */ (0, x.jsxs)("span", { children: ["הטקסט המפנה: ", e.referenceTexts.map((e) => `“${e}”`).join(" · ")] })
							]
						}),
						/* @__PURE__ */ (0, x.jsx)("p", {
							className: "contractsRelationshipRationale",
							children: e.rationaleHe
						})
					]
				}, e.proposalKey))
			}),
			w.unresolvedReferences.length > 0 && /* @__PURE__ */ (0, x.jsxs)("details", {
				className: "contractsRelationshipUnresolved",
				children: [/* @__PURE__ */ (0, x.jsxs)("summary", { children: [w.unresolvedReferences.length, " הפניות נשמרו לבדיקה משום שלא נמצא להן יעד"] }), /* @__PURE__ */ (0, x.jsx)("ul", { children: w.unresolvedReferences.map((e, t) => /* @__PURE__ */ (0, x.jsxs)("li", { children: [
					/* @__PURE__ */ (0, x.jsx)("bdi", {
						dir: "ltr",
						children: e.sourceClauseKey
					}),
					" · “",
					e.referenceText,
					"” → ",
					e.targetLabelHe,
					". ",
					e.reasonHe
				] }, `${e.sourceClauseKey}-${e.targetClauseKey}-${t}`)) })]
			}),
			/* @__PURE__ */ (0, x.jsxs)("section", {
				className: "contractsSemanticRelationships",
				"aria-labelledby": "contracts-semantic-relationships-title",
				children: [
					/* @__PURE__ */ (0, x.jsxs)("div", {
						className: "contractsSectionHeader",
						children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [
							/* @__PURE__ */ (0, x.jsx)("p", {
								className: "contractsEyebrow",
								children: "R4.1 · גילוי קשרים סמנטיים"
							}),
							/* @__PURE__ */ (0, x.jsx)("h3", {
								id: "contracts-semantic-relationships-title",
								children: "הצעות קשר שאינן כתובות כהפניה ישירה"
							}),
							/* @__PURE__ */ (0, x.jsx)("p", { children: "הסוכן מדרג זוגות מתוך אותה גרסת חוזה ומציע קשר רק כאשר שתי הראיות תומכות בסוג הקשר ובכיוונו." })
						] }), /* @__PURE__ */ (0, x.jsxs)("div", {
							className: "contractsWorkspaceSaveState",
							role: "status",
							children: [/* @__PURE__ */ (0, x.jsx)("span", {
								className: f?.ready ? "contractsPlanReady" : "contractsDryBadge",
								children: f?.ready ? E > 0 ? `${E} קשרים שמורים · ${D} ממתינים לסקירה` : "תוצאות מלאות יישמרו ב־KAPAIM לסקירה" : "תצוגת איכות זמנית · אינה נשמרת"
							}), /* @__PURE__ */ (0, x.jsx)("span", {
								className: "contractsDryBadge",
								children: "ללא יצירת החלטות · ללא הכרעה בסתירות"
							})]
						})]
					}),
					/* @__PURE__ */ (0, x.jsx)("div", {
						className: "contractsRelationshipBoundary is-semantic",
						role: "note",
						children: "דמיון בנושא בלבד אינו מספיק. כל הצעה עוברת כלל מקור קשיח ובדיקה ספקנית נפרדת של המודל. ביטחון הסיווג אינו ודאות משפטית. רק הצעות בביטחון גבוה שעוברות גם בדיקות פערים עשויות לקבל אישור אוטומטי; כל היתר נשארות לסקירה אנושית."
					}),
					/* @__PURE__ */ (0, x.jsxs)("div", {
						className: "contractsRelationshipActions",
						children: [/* @__PURE__ */ (0, x.jsx)("button", {
							type: "button",
							className: "contractsPrimary",
							disabled: !k,
							onClick: d,
							children: u ? "מאתר, בודק ושומר קשרים סמנטיים…" : f?.ready ? c ? "הרץ שוב ושמור ללא כפילויות" : "הרץ, אמת ושמור הצעות לסקירה" : c ? "הרץ שוב תצוגת קשרים סמנטיים" : "הרץ תצוגת קשרים סמנטיים"
						}), /* @__PURE__ */ (0, x.jsx)("p", { children: t ? s?.applyApproved ? s?.modelConfigured ? f?.ready ? "רק ניתוח מלא שעבר את הבדיקה הספקנית יישמר; הרצה חוזרת משתמשת ברשומות קיימות ואינה מוחקת החלטות סקירה." : "הניתוח משתמש רק בסעיפים השמורים ובמפתח המודל שבשרת; הדפדפן אינו שולח סעיפים או הגדרות מודל." : "מפתח המודל אינו מוגדר בשרת." : "הפעלת R4.1 המקומית עדיין לא אושרה בשרת." : "הניתוח זמין לאחר פתיחת חילוץ סעיפים שמור." })]
					}),
					l && /* @__PURE__ */ (0, x.jsx)("div", {
						className: "contractsMessage is-error",
						role: "alert",
						children: l
					}),
					m && /* @__PURE__ */ (0, x.jsx)("div", {
						className: "contractsMessage is-error",
						role: "alert",
						children: m
					}),
					c && /* @__PURE__ */ (0, x.jsxs)(x.Fragment, { children: [
						!ee && /* @__PURE__ */ (0, x.jsxs)("div", {
							className: "contractsMessage is-warning",
							role: "status",
							children: [
								"הניתוח הושלם חלקית ובאופן בטוח. ",
								[M > 0 ? `${M} זוגות לא סווגו משום שתשובת המסווג לא הייתה תקינה.` : "", N > 0 ? `${N} זוגות לא הוצגו משום שהבדיקה הספקנית שלהם לא הושלמה.` : ""].filter(Boolean).join(" "),
								" אפשר להריץ שוב כדי לנסות להשלים אותם."
							]
						}),
						/* @__PURE__ */ (0, x.jsxs)("div", {
							className: "contractsClauseMetrics",
							"aria-label": "מדדי גילוי קשרים סמנטיים",
							children: [
								/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "זוגות מועמדים שנבחרו" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: c.metrics?.candidatePairCount || 0 })] }),
								/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "זוגות שנבדקו בידי המודל" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: c.metrics?.modelAssessedPairCount || 0 })] }),
								/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "זוגות שלא סווגו עקב תשובה לא תקינה" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: M })] }),
								/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "קשרים שהציע המסווג" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: c.metrics?.classifierRelationshipCount || 0 })] }),
								/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "הצעות שנשלחו לבדיקה ספקנית" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: c.metrics?.relationshipVerificationAssessedCount || 0 })] }),
								/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "הצעות שנדחו בכלל מקור קשיח" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: c.metrics?.deterministicTypeGateRejectedCount || 0 })] }),
								/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "הצעות שנדחו בבדיקה הספקנית" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: c.metrics?.relationshipVerificationRejectedCount || 0 })] }),
								/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "זוגות שלא הוצגו עקב כשל בבדיקה" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: N })] }),
								/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "הצעות סופיות לסקירה" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: c.metrics?.modelRelationshipCount || 0 })] }),
								/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "זוגות שסווגו ללא קשר" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: c.metrics?.noRelationshipCount || 0 })] }),
								/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "הצעות מתחת לסף הביטחון" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: c.metrics?.belowThresholdCount || 0 })] }),
								/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "מתוכן: סתירות בין צדדים שונים שנדחו" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: c.metrics?.asymmetricConflictRejectedCount || 0 })] }),
								/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "החלטות חוזיות שנוצרו" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: c.metrics?.decisionCount || 0 })] }),
								/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "קשרים שמורים לסקירה" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: E })] }),
								/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "כתיבות ללוח הזמנים" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: c.metrics?.scheduleWriteCount || 0 })] })
							]
						}),
						/* @__PURE__ */ (0, x.jsx)("div", {
							className: "contractsRelationshipList",
							children: (c.proposals || []).map((e) => /* @__PURE__ */ (0, x.jsxs)("article", {
								className: "contractsRelationshipCard is-semantic",
								children: [
									/* @__PURE__ */ (0, x.jsxs)("div", {
										className: "contractsRelationshipRoute",
										children: [
											/* @__PURE__ */ (0, x.jsxs)("span", { children: [
												/* @__PURE__ */ (0, x.jsxs)("small", { children: ["סעיף מקור · עמודים ", e.sourcePageStart === e.sourcePageEnd ? e.sourcePageStart : `${e.sourcePageStart}–${e.sourcePageEnd}`] }),
												/* @__PURE__ */ (0, x.jsx)("strong", { children: /* @__PURE__ */ (0, x.jsx)("bdi", {
													dir: "ltr",
													children: e.sourceClauseKey
												}) }),
												/* @__PURE__ */ (0, x.jsx)("p", { children: e.sourceSummaryHe })
											] }),
											/* @__PURE__ */ (0, x.jsx)("b", {
												className: "contractsRelationshipArrow",
												"aria-label": "קשור אל",
												children: "←"
											}),
											/* @__PURE__ */ (0, x.jsxs)("span", { children: [
												/* @__PURE__ */ (0, x.jsxs)("small", { children: ["סעיף יעד · עמודים ", e.targetPageStart === e.targetPageEnd ? e.targetPageStart : `${e.targetPageStart}–${e.targetPageEnd}`] }),
												/* @__PURE__ */ (0, x.jsx)("strong", { children: /* @__PURE__ */ (0, x.jsx)("bdi", {
													dir: "ltr",
													children: e.targetClauseKey
												}) }),
												/* @__PURE__ */ (0, x.jsx)("p", { children: e.targetSummaryHe })
											] })
										]
									}),
									/* @__PURE__ */ (0, x.jsxs)("div", {
										className: "contractsRelationshipMeta",
										children: [
											/* @__PURE__ */ (0, x.jsx)("i", { children: Gn(e.relationshipType) }),
											/* @__PURE__ */ (0, x.jsx)("i", { children: Kn(e.origin) }),
											/* @__PURE__ */ (0, x.jsx)("i", { children: qn(e.reviewStatus) }),
											/* @__PURE__ */ (0, x.jsxs)("i", {
												title: "ביטחון סיווג של המודל לאחר בדיקה ספקנית; אינו ודאות משפטית",
												children: ["ביטחון סיווג: ", Gr(e.confidence)]
											})
										]
									}),
									/* @__PURE__ */ (0, x.jsx)("p", {
										className: "contractsRelationshipRationale",
										children: e.rationaleHe
									}),
									/* @__PURE__ */ (0, x.jsxs)("details", {
										className: "contractsRelationshipEvidence",
										children: [/* @__PURE__ */ (0, x.jsx)("summary", { children: "הצג את שתי הראיות המקוריות" }), /* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("blockquote", { children: e.sourceExcerpt }), /* @__PURE__ */ (0, x.jsx)("blockquote", { children: e.targetExcerpt })] })]
									})
								]
							}, e.proposalKey))
						}),
						(c.proposals || []).length === 0 && ee && /* @__PURE__ */ (0, x.jsx)("div", {
							className: "contractsMessage",
							role: "status",
							children: "לא נמצאה הצעת קשר שעברה את סף הביטחון. לא נוצרה תוצאה מלאכותית."
						}),
						(c.proposals || []).length === 0 && !ee && /* @__PURE__ */ (0, x.jsx)("div", {
							className: "contractsMessage",
							role: "status",
							children: "לא מוצגות הצעות שלא עברו סיווג ובדיקה ספקנית מלאים. אפשר להריץ שוב כדי להשלים את הניתוח."
						})
					] }),
					p && /* @__PURE__ */ (0, x.jsxs)("section", {
						className: "contractsRelationshipReviewQueue",
						"aria-labelledby": "contracts-relationship-review-title",
						children: [
							/* @__PURE__ */ (0, x.jsxs)("div", {
								className: "contractsSectionHeader",
								children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [
									/* @__PURE__ */ (0, x.jsx)("p", {
										className: "contractsEyebrow",
										children: "R4.2A + R4.2A.1 · סקירה שמורה ואישור אוטומטי בטוח"
									}),
									/* @__PURE__ */ (0, x.jsx)("h4", {
										id: "contracts-relationship-review-title",
										children: "הצעות קשר שנשמרו ב־KAPAIM"
									}),
									/* @__PURE__ */ (0, x.jsx)("p", { children: "כל פעולה יוצרת גרסה חדשה ביומן; שום הצעה קיימת אינה נדרסת או נמחקת." })
								] }), /* @__PURE__ */ (0, x.jsxs)("span", {
									className: "contractsPlanReady",
									children: [D, " ממתינים להחלטה"]
								})]
							}),
							/* @__PURE__ */ (0, x.jsxs)("div", {
								className: "contractsClauseMetrics",
								"aria-label": "מדדי סקירת קשרים שמורים",
								children: [
									/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "קשרים נוכחיים" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: p.metrics?.currentRelationshipCount || 0 })] }),
									/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "ממתינים לסקירה" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: D })] }),
									/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "אושרו" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: p.metrics?.approvedCount || 0 })] }),
									/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "תוקנו ואושרו" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: p.metrics?.correctedCount || 0 })] }),
									/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "נדחו" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: p.metrics?.rejectedCount || 0 })] }),
									/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "הוחלפו בתיקון" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: p.metrics?.supersededCount || 0 })] }),
									/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "החלטות חוזיות שנוצרו" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: p.metrics?.decisionCount || 0 })] }),
									/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "כתיבות ללוח הזמנים" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: p.metrics?.scheduleWriteCount || 0 })] })
								]
							}),
							/* @__PURE__ */ (0, x.jsxs)("div", {
								className: "contractsRelationshipActions",
								children: [/* @__PURE__ */ (0, x.jsx)("button", {
									type: "button",
									className: "contractsPrimary",
									disabled: !A,
									onClick: C,
									children: S ? "בודק ומאשר קשרים בטוחים…" : "אשר אוטומטית קשרים בטוחים"
								}), /* @__PURE__ */ (0, x.jsx)("p", { children: _?.ready ? D === 0 ? "אין קשרים שממתינים לבדיקה אוטומטית." : "הפעולה מאשרת בלבד: סתירות, כפילויות, פערי סכומים או מועדים ומקרים לא ודאיים נשארים לסקירה אנושית." : "מיגרציית R4.2A.1 נדרשת. אין צורך במשתנה סביבה חדש." })]
							}),
							y && /* @__PURE__ */ (0, x.jsx)("div", {
								className: "contractsMessage is-error",
								role: "alert",
								children: y
							}),
							v && /* @__PURE__ */ (0, x.jsxs)("div", {
								className: "contractsMessage is-success",
								role: "status",
								children: [
									"אושרו אוטומטית ",
									v.autoReview?.approvedCount || 0,
									" קשרים; ",
									v.autoReview?.humanReviewRequiredCount || 0,
									" נשארו לסקירה אנושית. לא נוצרו החלטות ולא בוצעו כתיבות ללוח הזמנים."
								]
							}),
							/* @__PURE__ */ (0, x.jsx)("div", {
								className: "contractsRelationshipList",
								children: (p.items || []).map((e) => /* @__PURE__ */ (0, x.jsx)(qr, {
									item: e,
									busy: h === e.relationshipId,
									onReview: g
								}, e.relationshipId))
							}),
							(p.items || []).length === 0 && /* @__PURE__ */ (0, x.jsx)("div", {
								className: "contractsMessage",
								role: "status",
								children: "עדיין לא נשמרו הצעות קשר סמנטיות עבור חילוץ זה."
							})
						]
					})
				]
			})
		]
	});
}
function Yr(e, { sourceClauseIds: t = null, primaryClauseId: n = null, titleHe: r = null, summaryHe: i = null, decisionTextHe: a = null, decisionCategory: o = null, scheduleImpact: s = null, responsibleParty: c = void 0, beneficiary: l = void 0 } = {}) {
	let u = (t || e.sourceEvidence?.map((e) => e.clauseId) || []).filter(Boolean), d = [...new Set((Array.isArray(e.tags) ? e.tags : []).map((e) => String(e || "").trim()).filter(Boolean).map((e) => /[\u0590-\u05ff]/u.test(e) ? e : jn(e)))].slice(0, 12);
	return {
		primaryClauseId: n || u[0],
		sourceClauseIds: u,
		titleHe: (r ?? e.titleHe ?? "").trim(),
		summaryHe: (i ?? e.summaryHe ?? "").trim(),
		decisionTextHe: (a ?? e.decisionTextHe ?? "").trim(),
		tags: d,
		responsibleParty: c === void 0 ? e.responsibleParty || null : c || null,
		beneficiary: l === void 0 ? e.beneficiary || null : l || null,
		decisionCategory: o || e.decisionCategory || "other",
		conflictStatus: e.conflictStatus || "none",
		scheduleImpact: s || e.scheduleImpact || "unknown",
		temporalKind: e.temporalKind || "none",
		contractDate: e.contractDate || null,
		triggerKind: e.triggerKind || null,
		triggerDescriptionHe: e.triggerDescriptionHe || null,
		offsetValue: e.offsetValue ?? null,
		offsetUnit: e.offsetUnit || null,
		calendarSemantics: e.calendarSemantics || "unknown",
		recurring: !!e.recurring
	};
}
function Xr(e, t) {
	let n = (e.sourceEvidence || []).map((e) => e.clauseId).filter(Boolean);
	return {
		id: `${e.decisionId}:split:${t}:${Date.now()}`,
		titleHe: `חלק ${t + 1}: ${e.titleHe || "החלטה חוזית"}`,
		summaryHe: e.summaryHe || "",
		decisionTextHe: e.decisionTextHe || "",
		decisionCategory: e.decisionCategory || "other",
		scheduleImpact: e.scheduleImpact || "unknown",
		sourceClauseIds: n,
		primaryClauseId: n[0] || ""
	};
}
function Zr({ item: e, busy: t = !1, onCancel: n, onSplit: r }) {
	let [i, a] = (0, b.useState)(""), [o, s] = (0, b.useState)(() => [Xr(e, 0), Xr(e, 1)]), c = Array.isArray(e.sourceEvidence) ? e.sourceEvidence : [], l = c.map((e) => e.clauseId).filter(Boolean);
	function u(e, t) {
		s((n) => n.map((n, r) => r === e ? {
			...n,
			...t
		} : n));
	}
	function d(e, t) {
		let n = o[e], r = n.sourceClauseIds.includes(t) ? n.sourceClauseIds.filter((e) => e !== t) : [...n.sourceClauseIds, t];
		u(e, {
			sourceClauseIds: r,
			primaryClauseId: r.includes(n.primaryClauseId) ? n.primaryClauseId : r[0] || ""
		});
	}
	let f = i.trim().length >= 10 && /[א-ת]/u.test(i), p = o.length >= 2 && o.every((e) => e.sourceClauseIds.length > 0 && e.sourceClauseIds.includes(e.primaryClauseId) && e.titleHe.trim().length >= 5 && /[א-ת]/u.test(e.titleHe) && e.summaryHe.trim().length >= 10 && /[א-ת]/u.test(e.summaryHe) && e.decisionTextHe.trim().length >= 10 && /[א-ת]/u.test(e.decisionTextHe)) && l.every((e) => o.some((t) => t.sourceClauseIds.includes(e)));
	function m() {
		r(e, {
			expectedRevision: e.revision,
			reasonHe: i.trim(),
			outputs: o.map((t) => Yr(e, t))
		});
	}
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		className: "contractsDecisionLineageEditor is-split",
		children: [
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "contractsSectionHeader",
				children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("strong", { children: "פיצול החלטה עם יוחסין מלאים" }), /* @__PURE__ */ (0, x.jsx)("p", { children: "כל חלק נשמר כהחלטה חדשה. אפשר להשתמש באותה ראיית מקור בכמה חלקים, אך יחד הם חייבים לכסות את כל הראיות המקוריות." })] }), /* @__PURE__ */ (0, x.jsx)("button", {
					type: "button",
					onClick: n,
					disabled: t,
					children: "בטל פיצול"
				})]
			}),
			/* @__PURE__ */ (0, x.jsx)("div", {
				className: "contractsDecisionSplitParts",
				children: o.map((e, n) => /* @__PURE__ */ (0, x.jsxs)("fieldset", {
					className: "contractsDecisionSplitPart",
					children: [
						/* @__PURE__ */ (0, x.jsxs)("legend", { children: ["החלטה חדשה ", n + 1] }),
						/* @__PURE__ */ (0, x.jsxs)("label", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "כותרת" }), /* @__PURE__ */ (0, x.jsx)("input", {
							value: e.titleHe,
							onChange: (e) => u(n, { titleHe: e.target.value }),
							disabled: t
						})] }),
						/* @__PURE__ */ (0, x.jsxs)("label", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "תקציר" }), /* @__PURE__ */ (0, x.jsx)("textarea", {
							rows: "3",
							value: e.summaryHe,
							onChange: (e) => u(n, { summaryHe: e.target.value }),
							disabled: t
						})] }),
						/* @__PURE__ */ (0, x.jsxs)("label", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "משמעות חוזית מנורמלת" }), /* @__PURE__ */ (0, x.jsx)("textarea", {
							rows: "4",
							value: e.decisionTextHe,
							onChange: (e) => u(n, { decisionTextHe: e.target.value }),
							disabled: t
						})] }),
						/* @__PURE__ */ (0, x.jsxs)("div", {
							className: "contractsDecisionLineageFields",
							children: [/* @__PURE__ */ (0, x.jsxs)("label", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "קטגוריה" }), /* @__PURE__ */ (0, x.jsx)("select", {
								value: e.decisionCategory,
								onChange: (e) => u(n, { decisionCategory: e.target.value }),
								disabled: t,
								children: Dr.map((e) => /* @__PURE__ */ (0, x.jsx)("option", {
									value: e,
									children: br(e)
								}, e))
							})] }), /* @__PURE__ */ (0, x.jsxs)("label", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "השפעה אפשרית על לוח הזמנים" }), /* @__PURE__ */ (0, x.jsxs)("select", {
								value: e.scheduleImpact,
								onChange: (e) => u(n, { scheduleImpact: e.target.value }),
								disabled: t,
								children: [
									/* @__PURE__ */ (0, x.jsx)("option", {
										value: "yes",
										children: "כן"
									}),
									/* @__PURE__ */ (0, x.jsx)("option", {
										value: "no",
										children: "לא"
									}),
									/* @__PURE__ */ (0, x.jsx)("option", {
										value: "unknown",
										children: "טרם הוכרע"
									})
								]
							})] })]
						}),
						/* @__PURE__ */ (0, x.jsxs)("div", {
							className: "contractsDecisionEvidencePicker",
							children: [/* @__PURE__ */ (0, x.jsx)("strong", { children: "ראיות מקור להחלטה זו" }), c.map((r, i) => /* @__PURE__ */ (0, x.jsxs)("label", { children: [/* @__PURE__ */ (0, x.jsx)("input", {
								type: "checkbox",
								checked: e.sourceClauseIds.includes(r.clauseId),
								onChange: () => d(n, r.clauseId),
								disabled: t
							}), /* @__PURE__ */ (0, x.jsxs)("span", { children: [
								"עמודים ",
								r.pageStart === r.pageEnd ? r.pageStart : `${r.pageStart}–${r.pageEnd}`,
								" · ",
								String(r.excerpt || "").slice(0, 180)
							] })] }, r.clauseId || i))]
						}),
						o.length > 2 && /* @__PURE__ */ (0, x.jsx)("button", {
							type: "button",
							onClick: () => s((e) => e.filter((e, t) => t !== n)),
							disabled: t,
							children: "הסר חלק"
						})
					]
				}, e.id))
			}),
			o.length < 10 && /* @__PURE__ */ (0, x.jsx)("button", {
				type: "button",
				onClick: () => s((t) => [...t, Xr(e, t.length)]),
				disabled: t,
				children: "הוסף החלטה לפיצול"
			}),
			/* @__PURE__ */ (0, x.jsxs)("label", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "נימוק הפיצול בעברית — לפחות 10 תווים" }), /* @__PURE__ */ (0, x.jsx)("textarea", {
				rows: "3",
				value: i,
				onChange: (e) => a(e.target.value),
				disabled: t
			})] }),
			!p && /* @__PURE__ */ (0, x.jsx)("p", {
				className: "contractsLineageValidation",
				children: "יש להשלים לפחות שתי החלטות ולוודא שכל ראיות המקור נכללות לפחות באחת מהן."
			}),
			/* @__PURE__ */ (0, x.jsx)("button", {
				type: "button",
				className: "contractsPrimary",
				disabled: !f || !p || t,
				onClick: m,
				children: "שמור פיצול אטומי"
			})
		]
	});
}
function Qr({ items: e, busy: t = !1, onCancel: n, onMerge: r }) {
	let [i, a] = (0, b.useState)(e[0]?.decisionId || ""), o = e.find((e) => e.decisionId === i) || e[0], [s, c] = (0, b.useState)(""), [l, u] = (0, b.useState)(o?.titleHe || ""), [d, f] = (0, b.useState)(o?.summaryHe || ""), [p, m] = (0, b.useState)(o?.decisionTextHe || ""), [h, g] = (0, b.useState)(o?.decisionCategory || "other"), [_, v] = (0, b.useState)(o?.scheduleImpact || "unknown"), y = /* @__PURE__ */ new Map();
	for (let t of e) for (let e of t.sourceEvidence || []) y.set(e.clauseId, e);
	let S = [...y.values()], C = [...new Set(e.flatMap((e) => Array.isArray(e.tags) ? e.tags : []))].slice(0, 12), w = e.some((e) => e.conflictStatus === "unresolved"), T = e.length >= 2 && s.trim().length >= 10 && /[א-ת]/u.test(s) && l.trim().length >= 5 && /[א-ת]/u.test(l) && d.trim().length >= 10 && /[א-ת]/u.test(d) && p.trim().length >= 10 && /[א-ת]/u.test(p) && S.length > 0;
	function E(t) {
		let n = e.find((e) => e.decisionId === t);
		a(t), u(n?.titleHe || ""), f(n?.summaryHe || ""), m(n?.decisionTextHe || ""), g(n?.decisionCategory || "other"), v(n?.scheduleImpact || "unknown");
	}
	function D() {
		let t = Yr({
			...o,
			tags: C,
			conflictStatus: w ? "unresolved" : o.conflictStatus
		}, {
			sourceClauseIds: S.map((e) => e.clauseId),
			primaryClauseId: S.some((e) => e.clauseId === o.primaryClauseId) ? o.primaryClauseId : S[0]?.clauseId,
			titleHe: l,
			summaryHe: d,
			decisionTextHe: p,
			decisionCategory: h,
			scheduleImpact: _
		});
		r({
			sources: e.map((e) => ({
				decisionId: e.decisionId,
				expectedRevision: e.revision
			})),
			reasonHe: s.trim(),
			output: t
		});
	}
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		className: "contractsDecisionLineageEditor is-merge",
		children: [
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "contractsSectionHeader",
				children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsxs)("strong", { children: [
					"מיזוג ",
					e.length,
					" החלטות"
				] }), /* @__PURE__ */ (0, x.jsx)("p", { children: "ההחלטות המקוריות יסומנו כממוזגות, תיווצר החלטה חדשה וכל קישורי היוחסין והראיות יישמרו אטומית." })] }), /* @__PURE__ */ (0, x.jsx)("button", {
					type: "button",
					onClick: n,
					disabled: t,
					children: "בטל בחירה"
				})]
			}),
			/* @__PURE__ */ (0, x.jsxs)("label", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "החלטת בסיס לשדות הזמנים והגורמים" }), /* @__PURE__ */ (0, x.jsx)("select", {
				value: i,
				onChange: (e) => E(e.target.value),
				disabled: t,
				children: e.map((e) => /* @__PURE__ */ (0, x.jsx)("option", {
					value: e.decisionId,
					children: e.titleHe
				}, e.decisionId))
			})] }),
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "contractsDecisionLineageFields",
				children: [
					/* @__PURE__ */ (0, x.jsxs)("label", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "כותרת ההחלטה הממוזגת" }), /* @__PURE__ */ (0, x.jsx)("input", {
						value: l,
						onChange: (e) => u(e.target.value),
						disabled: t
					})] }),
					/* @__PURE__ */ (0, x.jsxs)("label", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "קטגוריה" }), /* @__PURE__ */ (0, x.jsx)("select", {
						value: h,
						onChange: (e) => g(e.target.value),
						disabled: t,
						children: Dr.map((e) => /* @__PURE__ */ (0, x.jsx)("option", {
							value: e,
							children: br(e)
						}, e))
					})] }),
					/* @__PURE__ */ (0, x.jsxs)("label", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "השפעה אפשרית על לוח הזמנים" }), /* @__PURE__ */ (0, x.jsxs)("select", {
						value: _,
						onChange: (e) => v(e.target.value),
						disabled: t,
						children: [
							/* @__PURE__ */ (0, x.jsx)("option", {
								value: "yes",
								children: "כן"
							}),
							/* @__PURE__ */ (0, x.jsx)("option", {
								value: "no",
								children: "לא"
							}),
							/* @__PURE__ */ (0, x.jsx)("option", {
								value: "unknown",
								children: "טרם הוכרע"
							})
						]
					})] })
				]
			}),
			/* @__PURE__ */ (0, x.jsxs)("label", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "תקציר מאוחד" }), /* @__PURE__ */ (0, x.jsx)("textarea", {
				rows: "3",
				value: d,
				onChange: (e) => f(e.target.value),
				disabled: t
			})] }),
			/* @__PURE__ */ (0, x.jsxs)("label", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "משמעות חוזית מאוחדת" }), /* @__PURE__ */ (0, x.jsx)("textarea", {
				rows: "5",
				value: p,
				onChange: (e) => m(e.target.value),
				disabled: t
			})] }),
			/* @__PURE__ */ (0, x.jsx)("div", {
				className: "contractsDecisionMergeSources",
				children: e.map((e) => /* @__PURE__ */ (0, x.jsxs)("span", { children: [
					e.titleHe,
					" · גרסה ",
					e.revision
				] }, e.decisionId))
			}),
			/* @__PURE__ */ (0, x.jsxs)("p", { children: [
				"המיזוג ישמור ",
				S.length,
				" ראיות מקור מאוחדות. ",
				w ? "הסתירה תישאר לא פתורה; לא תיבחר הוראה גוברת." : "לא מתבצעת הכרעה משפטית אוטומטית."
			] }),
			/* @__PURE__ */ (0, x.jsxs)("label", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "נימוק המיזוג בעברית — לפחות 10 תווים" }), /* @__PURE__ */ (0, x.jsx)("textarea", {
				rows: "3",
				value: s,
				onChange: (e) => c(e.target.value),
				disabled: t
			})] }),
			/* @__PURE__ */ (0, x.jsx)("button", {
				type: "button",
				className: "contractsPrimary",
				disabled: !T || t,
				onClick: D,
				children: "שמור מיזוג אטומי"
			})
		]
	});
}
function $r({ item: e, busy: t = !1, lineageEnabled: n = !1, selectedForMerge: r = !1, onToggleMerge: i, onSplit: a, onReview: o }) {
	let [s, c] = (0, b.useState)(""), [l, u] = (0, b.useState)(!1), [d, f] = (0, b.useState)(!1), [p, m] = (0, b.useState)(() => ({
		titleHe: e.titleHe || "",
		summaryHe: e.summaryHe || "",
		decisionTextHe: e.decisionTextHe || "",
		responsibleParty: e.responsibleParty || "",
		beneficiary: e.beneficiary || "",
		decisionCategory: e.decisionCategory || "other",
		scheduleImpact: e.scheduleImpact || "unknown"
	})), h = e.reviewStatus === "proposed", g = n && [
		"proposed",
		"approved",
		"corrected",
		"unresolved"
	].includes(e.reviewStatus) && e.projectionStatus !== "projected", _ = s.trim().length >= 10 && /[א-ת]/u.test(s), v = /[א-ת]/u.test(p.titleHe) && p.titleHe.trim().length >= 5 && /[א-ת]/u.test(p.summaryHe) && p.summaryHe.trim().length >= 10 && /[א-ת]/u.test(p.decisionTextHe) && p.decisionTextHe.trim().length >= 10, y = Array.isArray(e.sourceEvidence) ? e.sourceEvidence : [];
	function S(t) {
		o(e, t, {
			reasonHe: s.trim(),
			...t === "correct" ? { correction: {
				titleHe: p.titleHe.trim(),
				summaryHe: p.summaryHe.trim(),
				decisionTextHe: p.decisionTextHe.trim(),
				responsibleParty: p.responsibleParty.trim() || null,
				beneficiary: p.beneficiary.trim() || null,
				decisionCategory: p.decisionCategory,
				conflictStatus: e.conflictStatus || "none",
				scheduleImpact: p.scheduleImpact,
				temporalKind: e.temporalKind || "none",
				contractDate: e.contractDate || null,
				triggerKind: e.triggerKind || null,
				triggerDescriptionHe: e.triggerDescriptionHe || null,
				offsetValue: e.offsetValue ?? null,
				offsetUnit: e.offsetUnit || null,
				calendarSemantics: e.calendarSemantics || "unknown",
				recurring: !!e.recurring
			} } : {}
		});
	}
	return /* @__PURE__ */ (0, x.jsxs)("article", {
		className: `contractsDecisionCard is-${e.reviewStatus}`,
		children: [
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "contractsDecisionCardHeader",
				children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsxs)("small", { children: [
					br(e.decisionCategory),
					" · גרסה ",
					e.revision
				] }), /* @__PURE__ */ (0, x.jsx)("h4", { children: e.titleHe })] }), /* @__PURE__ */ (0, x.jsx)("span", {
					className: "contractsPlanReady",
					children: xr(e.reviewStatus)
				})]
			}),
			/* @__PURE__ */ (0, x.jsx)("p", {
				className: "contractsDecisionSummary",
				children: e.summaryHe
			}),
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "contractsDecisionMeaning",
				children: [/* @__PURE__ */ (0, x.jsx)("strong", { children: "המשמעות החוזית המנורמלת" }), /* @__PURE__ */ (0, x.jsx)("p", { children: e.decisionTextHe })]
			}),
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "contractsRelationshipMeta",
				children: [
					/* @__PURE__ */ (0, x.jsx)("i", { children: Sr(e.scheduleImpact) }),
					/* @__PURE__ */ (0, x.jsx)("i", { children: Cr(e.temporalKind) }),
					e.responsibleParty && /* @__PURE__ */ (0, x.jsxs)("i", { children: ["אחראי: ", e.responsibleParty] }),
					e.beneficiary && /* @__PURE__ */ (0, x.jsxs)("i", { children: ["זכאי: ", e.beneficiary] }),
					e.conflictStatus === "unresolved" && /* @__PURE__ */ (0, x.jsx)("i", { children: "סתירה לא פתורה · לא נבחרה חלופה" })
				]
			}),
			(e.contractDate || e.triggerDescriptionHe || e.offsetValue !== null && e.offsetValue !== void 0) && /* @__PURE__ */ (0, x.jsxs)("div", {
				className: "contractsDecisionTemporal",
				children: [
					e.contractDate && /* @__PURE__ */ (0, x.jsxs)("span", { children: ["מועד חוזי מפורש: ", /* @__PURE__ */ (0, x.jsx)("bdi", {
						dir: "ltr",
						children: e.contractDate
					})] }),
					e.triggerDescriptionHe && /* @__PURE__ */ (0, x.jsxs)("span", { children: ["אירוע מפעיל: ", e.triggerDescriptionHe] }),
					e.offsetValue !== null && e.offsetValue !== void 0 && /* @__PURE__ */ (0, x.jsxs)("span", { children: [
						"מרווח מקור: ",
						e.offsetValue,
						" ",
						vr(e.offsetUnit)
					] })
				]
			}),
			/* @__PURE__ */ (0, x.jsxs)("details", {
				className: "contractsRelationshipEvidence",
				children: [/* @__PURE__ */ (0, x.jsxs)("summary", { children: [
					"הצג ",
					y.length,
					" ראיות מקור מדויקות"
				] }), /* @__PURE__ */ (0, x.jsx)("div", { children: y.map((e, t) => /* @__PURE__ */ (0, x.jsxs)("blockquote", { children: [/* @__PURE__ */ (0, x.jsxs)("small", { children: ["עמודים ", e.pageStart === e.pageEnd ? e.pageStart : `${e.pageStart}–${e.pageEnd}`] }), e.excerpt] }, e.clauseId || t)) })]
			}),
			g && /* @__PURE__ */ (0, x.jsxs)("div", {
				className: "contractsDecisionLineageActions",
				role: "group",
				"aria-label": "פעולות פיצול ומיזוג",
				children: [/* @__PURE__ */ (0, x.jsx)("button", {
					type: "button",
					disabled: t,
					onClick: () => f((e) => !e),
					children: d ? "סגור פיצול" : "פצל החלטה"
				}), /* @__PURE__ */ (0, x.jsxs)("label", { children: [/* @__PURE__ */ (0, x.jsx)("input", {
					type: "checkbox",
					checked: r,
					onChange: () => i(e),
					disabled: t
				}), "בחר למיזוג"] })]
			}),
			d && g && /* @__PURE__ */ (0, x.jsx)(Zr, {
				item: e,
				busy: t,
				onCancel: () => f(!1),
				onSplit: a
			}),
			h ? /* @__PURE__ */ (0, x.jsxs)("div", {
				className: "contractsDecisionReviewForm",
				children: [
					/* @__PURE__ */ (0, x.jsxs)("label", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "נימוק סקירה בעברית — לפחות 10 תווים" }), /* @__PURE__ */ (0, x.jsx)("textarea", {
						rows: "2",
						value: s,
						onChange: (e) => c(e.target.value),
						placeholder: "לדוגמה: ההחלטה משקפת במדויק את הסעיפים המצוטטים ואת הגורם האחראי.",
						disabled: t
					})] }),
					/* @__PURE__ */ (0, x.jsxs)("div", {
						className: "contractsRelationshipReviewActions",
						children: [
							/* @__PURE__ */ (0, x.jsx)("button", {
								type: "button",
								className: "contractsPrimary",
								disabled: !_ || t,
								onClick: () => S("approve"),
								children: "אשר החלטה"
							}),
							/* @__PURE__ */ (0, x.jsx)("button", {
								type: "button",
								disabled: !_ || t,
								onClick: () => S("reject"),
								children: "דחה החלטה"
							}),
							/* @__PURE__ */ (0, x.jsx)("button", {
								type: "button",
								disabled: !_ || t,
								onClick: () => S("unresolved"),
								children: "סמן כלא פתורה"
							}),
							/* @__PURE__ */ (0, x.jsx)("button", {
								type: "button",
								disabled: t,
								onClick: () => u((e) => !e),
								children: "תקן לפני אישור"
							})
						]
					}),
					l && /* @__PURE__ */ (0, x.jsxs)("div", {
						className: "contractsDecisionCorrection",
						children: [
							/* @__PURE__ */ (0, x.jsxs)("label", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "כותרת ההחלטה" }), /* @__PURE__ */ (0, x.jsx)("input", {
								value: p.titleHe,
								onChange: (e) => m((t) => ({
									...t,
									titleHe: e.target.value
								})),
								disabled: t
							})] }),
							/* @__PURE__ */ (0, x.jsxs)("label", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "תקציר" }), /* @__PURE__ */ (0, x.jsx)("textarea", {
								rows: "3",
								value: p.summaryHe,
								onChange: (e) => m((t) => ({
									...t,
									summaryHe: e.target.value
								})),
								disabled: t
							})] }),
							/* @__PURE__ */ (0, x.jsxs)("label", {
								className: "contractsDecisionCorrectionWide",
								children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "משמעות חוזית מנורמלת" }), /* @__PURE__ */ (0, x.jsx)("textarea", {
									rows: "5",
									value: p.decisionTextHe,
									onChange: (e) => m((t) => ({
										...t,
										decisionTextHe: e.target.value
									})),
									disabled: t
								})]
							}),
							/* @__PURE__ */ (0, x.jsxs)("label", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "קטגוריה" }), /* @__PURE__ */ (0, x.jsx)("select", {
								value: p.decisionCategory,
								onChange: (e) => m((t) => ({
									...t,
									decisionCategory: e.target.value
								})),
								disabled: t,
								children: Dr.map((e) => /* @__PURE__ */ (0, x.jsx)("option", {
									value: e,
									children: br(e)
								}, e))
							})] }),
							/* @__PURE__ */ (0, x.jsxs)("label", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "השפעה חוזית אפשרית על לוח הזמנים" }), /* @__PURE__ */ (0, x.jsxs)("select", {
								value: p.scheduleImpact,
								onChange: (e) => m((t) => ({
									...t,
									scheduleImpact: e.target.value
								})),
								disabled: t,
								children: [
									/* @__PURE__ */ (0, x.jsx)("option", {
										value: "yes",
										children: "כן"
									}),
									/* @__PURE__ */ (0, x.jsx)("option", {
										value: "no",
										children: "לא"
									}),
									/* @__PURE__ */ (0, x.jsx)("option", {
										value: "unknown",
										children: "טרם הוכרע"
									})
								]
							})] }),
							/* @__PURE__ */ (0, x.jsxs)("label", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "גורם אחראי" }), /* @__PURE__ */ (0, x.jsx)("input", {
								value: p.responsibleParty,
								onChange: (e) => m((t) => ({
									...t,
									responsibleParty: e.target.value
								})),
								disabled: t
							})] }),
							/* @__PURE__ */ (0, x.jsxs)("label", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "גורם זכאי" }), /* @__PURE__ */ (0, x.jsx)("input", {
								value: p.beneficiary,
								onChange: (e) => m((t) => ({
									...t,
									beneficiary: e.target.value
								})),
								disabled: t
							})] }),
							/* @__PURE__ */ (0, x.jsx)("button", {
								type: "button",
								className: "contractsPrimary",
								disabled: !_ || !v || t,
								onClick: () => S("correct"),
								children: "שמור תיקון ואשר"
							})
						]
					})
				]
			}) : /* @__PURE__ */ (0, x.jsxs)("div", {
				className: "contractsRelationshipReviewedState",
				role: "status",
				children: [
					/* @__PURE__ */ (0, x.jsx)("strong", { children: xr(e.reviewStatus) }),
					e.reviewReason && /* @__PURE__ */ (0, x.jsx)("p", { children: e.reviewReason }),
					e.reviewedAt && /* @__PURE__ */ (0, x.jsx)("time", {
						dateTime: e.reviewedAt,
						children: wr(e.reviewedAt)
					})
				]
			})
		]
	});
}
function ei({ status: e, lineageStatus: t, result: n, autoReviewStatus: r, autoReviewResult: i, autoReviewError: a = "", autoReviewBusy: o = !1, relationshipPendingCount: s = 0, error: c = "", generationBusy: l = !1, reviewBusyId: u = "", onGenerate: d, onAutoReview: f, onSplit: p, onMerge: m, onReview: h }) {
	let [g, _] = (0, b.useState)([]), v = Number(n?.metrics?.pendingRelationshipCount ?? s ?? 0), y = Number(n?.metrics?.currentDecisionCount || 0), S = Number(n?.lineage?.metrics?.activeDecisionCount ?? y), C = Number(n?.metrics?.proposedCount || 0), w = !!(t?.ready && n?.lineage?.gates?.splitEnabled && n?.lineage?.gates?.mergeEnabled), T = new Map((n?.items || []).map((e) => [e.decisionId, e])), E = g.map((e) => T.get(e)).filter(Boolean), D = !!(e?.ready && n?.workspace?.workspaceId && v === 0 && y === 0 && !l), O = !!(r?.ready && C > 0 && !l && !o && !u), k = i?.plan?.metrics;
	function A(e) {
		_((t) => t.includes(e.decisionId) ? t.filter((t) => t !== e.decisionId) : t.length < 10 ? [...t, e.decisionId] : t);
	}
	function j(e) {
		m(e);
	}
	return /* @__PURE__ */ (0, x.jsxs)("section", {
		className: "contractsPanel contractsDecisionsPanel",
		"aria-labelledby": "contracts-decisions-title",
		children: [
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "contractsSectionHeader",
				children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [
					/* @__PURE__ */ (0, x.jsx)("p", {
						className: "contractsEyebrow",
						children: "סוכן ההחלטות בחוזים · R4.2B + R4.2C"
					}),
					/* @__PURE__ */ (0, x.jsx)("h2", {
						id: "contracts-decisions-title",
						children: "4. החלטות חוזיות מנורמלות"
					}),
					/* @__PURE__ */ (0, x.jsx)("p", { children: "הסוכן מאחד סעיפים קשורים להצעה אחת; הסוקר יכול לאשר, לתקן, לפצל או למזג, וכל פעולה נשמרת עם ראיות ויוחסין בלתי־ניתנים לדריסה." })
				] }), /* @__PURE__ */ (0, x.jsxs)("div", {
					className: "contractsWorkspaceSaveState",
					role: "status",
					children: [/* @__PURE__ */ (0, x.jsx)("span", {
						className: y > 0 ? "contractsPlanReady" : "contractsDryBadge",
						children: y > 0 ? `${y} החלטות שמורות ב־KAPAIM` : "טרם נוצרו הצעות החלטה"
					}), /* @__PURE__ */ (0, x.jsx)("span", {
						className: "contractsDryBadge",
						children: "ללא הכרעת סתירות · ללא כתיבה ללוח הזמנים"
					})]
				})]
			}),
			/* @__PURE__ */ (0, x.jsx)("div", {
				className: "contractsRelationshipBoundary is-semantic",
				role: "note",
				children: "R4.2B משתמש רק בסעיפים ובקשרים השמורים. R4.2C אינו קורא שוב למודל: פיצול ומיזוג הם פעולות סוקר אטומיות בלבד. אף אחד מהשלבים אינו בוחר הוראה גוברת, מחשב מועד ביצוע או כותב ללוח הזמנים."
			}),
			/* @__PURE__ */ (0, x.jsx)("div", {
				className: w ? "contractsMessage is-success" : "contractsMessage is-warning",
				role: "status",
				children: w ? "R4.2C פעיל: אפשר לפצל החלטה או לבחור 2–10 החלטות למיזוג. כל קישור יוחסין נשמר ב־KAPAIM." : "פעולות הפיצול והמיזוג יופיעו לאחר הפעלת מיגרציית R4.2C בצד השרת."
			}),
			v > 0 ? /* @__PURE__ */ (0, x.jsxs)("div", {
				className: "contractsMessage is-warning",
				role: "status",
				children: [
					"לפני יצירת החלטות יש לעבור על ",
					v,
					" הצעות הקשר שנותרו למעלה. לאחר ההחלטה האחרונה הכפתור ייפתח אוטומטית."
				]
			}) : /* @__PURE__ */ (0, x.jsx)("div", {
				className: "contractsMessage is-success",
				role: "status",
				children: "סקירת הקשרים הושלמה. אפשר ליצור ולשמור את הצעות ההחלטה המנורמלות."
			}),
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "contractsRelationshipActions",
				children: [/* @__PURE__ */ (0, x.jsx)("button", {
					type: "button",
					className: "contractsPrimary",
					disabled: !D,
					onClick: d,
					children: l ? "מנרמל ושומר את כל הצעות ההחלטה…" : y > 0 ? "הצעות ההחלטה כבר שמורות" : "צור ושמור הצעות החלטה"
				}), /* @__PURE__ */ (0, x.jsx)("p", { children: e?.applyApproved ? e?.modelConfigured ? v > 0 ? "היצירה נעולה עד שכל קשר נשמר כאישור, תיקון או דחייה." : y > 0 ? "הרצה חוזרת אינה קוראת שוב למודל ואינה מחליפה החלטות שכבר נשמרו." : "היצירה אטומית: אם הצעה אחת אינה תקינה, לא תישמר תוצאה חלקית." : "מפתח המודל אינו מוגדר בצד השרת." : "הפעלת R4.2B המקומית או המיגרציה עדיין אינן זמינות." })]
			}),
			y > 0 && /* @__PURE__ */ (0, x.jsxs)("div", {
				className: "contractsRelationshipActions contractsDecisionAutoReviewActions",
				children: [/* @__PURE__ */ (0, x.jsx)("button", {
					type: "button",
					className: "contractsPrimary",
					disabled: !O,
					onClick: f,
					children: o ? "בודק כל החלטה בבדיקה עצמאית…" : C > 0 ? "בדוק ואשר אוטומטית החלטות בטוחות" : "אין החלטות שממתינות לסקירה"
				}), /* @__PURE__ */ (0, x.jsx)("p", { children: "בודק עצמאי מאמת כל החלטה מול ראיות המקור. רק הסכמה בביטחון של 98% ומעלה עוברת אישור; כל ספק, פער מספרי או סיווג זמן חסר נשאר לסקירה אנושית. אין דחייה, תיקון או מסירה אוטומטית ל־Indicator." })]
			}),
			!r?.applyApproved && y > 0 && /* @__PURE__ */ (0, x.jsx)("div", {
				className: "contractsMessage is-warning",
				role: "status",
				children: "מסלול R4.2B.1 לאישור אוטומטי בטוח עדיין אינו זמין בתהליך השרת או ב־KAPAIM."
			}),
			a && /* @__PURE__ */ (0, x.jsx)("div", {
				className: "contractsMessage is-error",
				role: "alert",
				children: a
			}),
			k && /* @__PURE__ */ (0, x.jsxs)("div", {
				className: "contractsClauseMetrics",
				"aria-label": "מדדי אישור אוטומטי של החלטות",
				children: [
					/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "נבדקו" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: k.inputPendingCount || 0 })] }),
					/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "אושרו אוטומטית" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: i.autoReview?.approvedCount || 0 })] }),
					/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "נשארו לסקירה אנושית" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: i.autoReview?.humanReviewRequiredCount || 0 })] }),
					/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "קריאות לבודק" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: k.modelCallCount || 0 })] }),
					/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "קבוצות בדיקה שנכשלו בבטחה" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: k.failedBatchCount || 0 })] }),
					/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "כתיבות ללוח הזמנים" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: k.scheduleWriteCount || 0 })] })
				]
			}),
			c && /* @__PURE__ */ (0, x.jsx)("div", {
				className: "contractsMessage is-error",
				role: "alert",
				children: c
			}),
			n && y > 0 && /* @__PURE__ */ (0, x.jsxs)(x.Fragment, { children: [
				/* @__PURE__ */ (0, x.jsxs)("div", {
					className: "contractsClauseMetrics",
					"aria-label": "מדדי החלטות חוזיות שמורות",
					children: [
						/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "החלטות פעילות" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: S })] }),
						/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "ממתינות לסקירה" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: C })] }),
						/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "אושרו" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: n.metrics?.approvedCount || 0 })] }),
						/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "תוקנו ואושרו" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: n.metrics?.correctedCount || 0 })] }),
						/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "נדחו" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: n.metrics?.rejectedCount || 0 })] }),
						/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "סומנו כלא פתורות" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: n.metrics?.unresolvedCount || 0 })] }),
						/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "מקורות שפוצלו" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: n.lineage?.metrics?.splitParentCount || 0 })] }),
						/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "מקורות שמוזגו" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: n.lineage?.metrics?.mergedSourceCount || 0 })] }),
						/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "קישורי יוחסין שמורים" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: n.lineage?.metrics?.lineageLinkCount || 0 })] }),
						/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "כתיבות ללוח הזמנים" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: n.metrics?.scheduleWriteCount || 0 })] })
					]
				}),
				w && E.length > 0 && E.length < 2 && /* @__PURE__ */ (0, x.jsx)("div", {
					className: "contractsMessage is-warning",
					role: "status",
					children: "נבחרה החלטה אחת למיזוג. יש לבחור לפחות החלטה נוספת."
				}),
				w && E.length >= 2 && /* @__PURE__ */ (0, x.jsx)(Qr, {
					items: E,
					busy: u === "lineage:merge",
					onCancel: () => _([]),
					onMerge: j
				}, E.map((e) => e.decisionId).join(":")),
				/* @__PURE__ */ (0, x.jsx)("div", {
					className: "contractsDecisionList",
					children: (n.items || []).map((e) => /* @__PURE__ */ (0, x.jsx)($r, {
						item: e,
						busy: u === e.decisionId || u === `lineage:${e.decisionId}` || u === "lineage:merge",
						lineageEnabled: w,
						selectedForMerge: g.includes(e.decisionId),
						onToggleMerge: A,
						onSplit: p,
						onReview: h
					}, e.decisionId))
				}),
				(n.lineage?.links || []).length > 0 && /* @__PURE__ */ (0, x.jsxs)("section", {
					className: "contractsDecisionLineageHistory",
					"aria-labelledby": "contracts-lineage-history-title",
					children: [/* @__PURE__ */ (0, x.jsx)("div", {
						className: "contractsSectionHeader",
						children: /* @__PURE__ */ (0, x.jsxs)("div", { children: [
							/* @__PURE__ */ (0, x.jsx)("p", {
								className: "contractsEyebrow",
								children: "R4.2C · יומן יוחסין שמור"
							}),
							/* @__PURE__ */ (0, x.jsx)("h3", {
								id: "contracts-lineage-history-title",
								children: "פיצולים ומיזוגים"
							}),
							/* @__PURE__ */ (0, x.jsx)("p", { children: "כל חץ הוא רשומת קשר עצמאית בגרף החוזי, עם סוקר, זמן ונימוק." })
						] })
					}), /* @__PURE__ */ (0, x.jsx)("div", {
						className: "contractsDecisionLineageLinks",
						children: (n.lineage.links || []).map((e) => {
							let t = T.get(e.sourceDecisionId), n = T.get(e.targetDecisionId);
							return /* @__PURE__ */ (0, x.jsxs)("article", { children: [
								/* @__PURE__ */ (0, x.jsx)("strong", { children: Gn(e.relationshipType) }),
								/* @__PURE__ */ (0, x.jsxs)("p", { children: [
									t?.titleHe || e.sourceDecisionId,
									" ← ",
									n?.titleHe || e.targetDecisionId
								] }),
								/* @__PURE__ */ (0, x.jsxs)("small", { children: [
									e.reviewReason,
									" · ",
									wr(e.reviewedAt)
								] })
							] }, e.relationshipId);
						})
					})]
				})
			] })
		]
	});
}
function ti({ item: e }) {
	return /* @__PURE__ */ (0, x.jsxs)("article", {
		className: `contractsScheduleProjectionCard is-${e.handoffStatus}`,
		children: [
			/* @__PURE__ */ (0, x.jsxs)("header", { children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: fr(e.handoffStatus) }), /* @__PURE__ */ (0, x.jsx)("h3", { children: e.titleHe })] }), /* @__PURE__ */ (0, x.jsx)("span", { children: e.reviewStatus || xr(e.reviewStatusCode) })] }),
			/* @__PURE__ */ (0, x.jsx)("p", { children: e.summaryHe }),
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "contractsRelationshipMeta",
				children: [
					/* @__PURE__ */ (0, x.jsx)("i", { children: e.categoryHe || br("other") }),
					/* @__PURE__ */ (0, x.jsx)("i", { children: e.indicatorSuitability || "נדרשת בדיקה" }),
					/* @__PURE__ */ (0, x.jsx)("i", { children: Cr(e.timing?.kind || "none") })
				]
			}),
			/* @__PURE__ */ (0, x.jsx)("ul", {
				className: "contractsScheduleProjectionBlockers",
				children: (e.reasonCodes || []).map((e) => /* @__PURE__ */ (0, x.jsx)("li", { children: dr(e) }, e))
			}),
			e.sourceEvidence?.length > 0 && /* @__PURE__ */ (0, x.jsxs)("details", {
				className: "contractsRelationshipEvidence",
				children: [/* @__PURE__ */ (0, x.jsx)("summary", { children: "הצג ראיות מקור מדויקות" }), /* @__PURE__ */ (0, x.jsx)("div", {
					className: "contractsScheduleAuditEvidence",
					children: e.sourceEvidence.map((t, n) => /* @__PURE__ */ (0, x.jsxs)("blockquote", { children: [/* @__PURE__ */ (0, x.jsxs)("small", { children: [
						"סעיף ",
						t.clauseKey || "ללא מספר",
						" · עמודים ",
						t.pageStart || "?",
						t.pageEnd && t.pageEnd !== t.pageStart ? `–${t.pageEnd}` : ""
					] }), /* @__PURE__ */ (0, x.jsx)("p", { children: t.excerpt })] }, `${t.clauseId || e.decisionId}:${n}`))
				})]
			})
		]
	});
}
function ni({ status: e, result: t, error: n = "", busy: r = !1, disabled: i = !1, onRun: a }) {
	let o = t?.metrics || {}, s = (t?.items || []).filter((e) => e.handoffStatus === "suitable"), c = (t?.items || []).filter((e) => e.handoffStatus === "requires_review"), l = (t?.items || []).filter((e) => e.handoffStatus === "not_suitable"), u = !!(e?.ready && e?.mode === "indicator_handoff_read_only");
	return /* @__PURE__ */ (0, x.jsxs)("section", {
		className: "contractsPanel contractsScheduleProjectionPanel",
		"aria-labelledby": "contracts-indicator-handoff-title",
		children: [
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "contractsSectionHeader",
				children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [
					/* @__PURE__ */ (0, x.jsx)("p", {
						className: "contractsEyebrow",
						children: "מסירת החלטות לסוכן Indicator · R5"
					}),
					/* @__PURE__ */ (0, x.jsx)("h2", {
						id: "contracts-indicator-handoff-title",
						children: "5. ערכת החלטות ל־Indicator"
					}),
					/* @__PURE__ */ (0, x.jsx)("p", { children: "סוכן החוזים קובע רק אילו החלטות חוזיות מתאימות להמשך טיפול. סוכן Indicator יקבע בהמשך פרויקט, יעד, פעילות, חישובי תאריך וכל כתיבה ללוח הזמנים." })
				] }), /* @__PURE__ */ (0, x.jsxs)("div", {
					className: "contractsWorkspaceSaveState",
					role: "status",
					children: [/* @__PURE__ */ (0, x.jsx)("span", {
						className: "contractsPlanReady",
						children: "ערכת מסירה לקריאה בלבד"
					}), /* @__PURE__ */ (0, x.jsx)("span", {
						className: "contractsDryBadge",
						children: "אפס כתיבות · ללא שיבוץ בלוח הזמנים"
					})]
				})]
			}),
			/* @__PURE__ */ (0, x.jsx)("div", {
				className: "contractsRelationshipBoundary is-semantic",
				role: "note",
				children: "הסיווג נגזר מן ההחלטה השמורה שכבר עברה סקירה: מתאימה ל־Indicator, אינה מתאימה, או דורשת השלמת סקירה. אין טבלת אמת נוספת ואין שכפול של ההחלטה החוזית."
			}),
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "contractsRelationshipActions",
				children: [/* @__PURE__ */ (0, x.jsx)("button", {
					type: "button",
					className: "contractsPrimary",
					disabled: !u || i,
					onClick: a,
					children: r ? "טוען ערכת מסירה…" : "טען את ערכת המסירה ל־Indicator"
				}), /* @__PURE__ */ (0, x.jsx)("p", { children: "הערכה משתמשת רק באמת החוזית השמורה. היא אינה קוראת פעילויות, אינה דורשת מיפוי פרויקט ואינה מפעילה את מנוע Schedule." })]
			}),
			!u && /* @__PURE__ */ (0, x.jsx)("div", {
				className: "contractsMessage is-warning",
				role: "status",
				children: "ערכת המסירה של R5 טרם הופעלה בתהליך השרת הנוכחי. יש להפעיל מחדש את השרת לאחר עדכון הקוד."
			}),
			n && /* @__PURE__ */ (0, x.jsx)("div", {
				className: "contractsMessage is-error",
				role: "alert",
				children: n
			}),
			t && /* @__PURE__ */ (0, x.jsxs)(x.Fragment, { children: [
				/* @__PURE__ */ (0, x.jsxs)("div", {
					className: "contractsClauseMetrics contractsScheduleProjectionMetrics",
					children: [
						/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "כל ההחלטות הנוכחיות" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: o.currentDecisionCount || 0 })] }),
						/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "מתאימות ל־Indicator" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: o.suitableCount || 0 })] }),
						/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "אינן מתאימות" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: o.notSuitableCount || 0 })] }),
						/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "דורשות סקירה" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: o.requiresReviewCount || 0 })] }),
						/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "קריאות למודל" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: o.modelCallCount || 0 })] }),
						/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "כתיבות אמת חוזית" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: o.contractTruthWriteCount || 0 })] }),
						/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "כתיבות ללוח הזמנים" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: o.scheduleWriteCount || 0 })] })
					]
				}),
				/* @__PURE__ */ (0, x.jsx)("div", {
					className: "contractsMessage is-success",
					role: "status",
					children: "ערכת המסירה הושלמה מתוך ההחלטות השמורות. סוכן החוזים לא בחר פרויקט, יעד או פעילות ולא כתב שורת Schedule."
				}),
				/* @__PURE__ */ (0, x.jsxs)("section", {
					className: "contractsScheduleAuditSection",
					"aria-labelledby": "contracts-indicator-suitable-title",
					children: [/* @__PURE__ */ (0, x.jsxs)("div", {
						className: "contractsSectionHeader",
						children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("h3", {
							id: "contracts-indicator-suitable-title",
							children: "החלטות מתאימות למסירה ל־Indicator"
						}), /* @__PURE__ */ (0, x.jsx)("p", { children: "אלו החלטות שנבדקו, סומנו כבעלות השפעה רלוונטית ואין בהן סתירה פתוחה. ה־Indicator יחליט לבדו אם וכיצד לשבץ אותן." })] }), /* @__PURE__ */ (0, x.jsxs)("span", {
							className: "contractsPlanReady",
							children: [s.length, " החלטות"]
						})]
					}), /* @__PURE__ */ (0, x.jsx)("div", {
						className: "contractsScheduleProjectionList",
						children: s.map((e) => /* @__PURE__ */ (0, x.jsx)(ti, { item: e }, e.decisionId))
					})]
				}),
				/* @__PURE__ */ (0, x.jsxs)("section", {
					className: "contractsScheduleAuditSection",
					"aria-labelledby": "contracts-indicator-review-title",
					children: [/* @__PURE__ */ (0, x.jsxs)("div", {
						className: "contractsSectionHeader",
						children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("h3", {
							id: "contracts-indicator-review-title",
							children: "החלטות הדורשות השלמת סקירה חוזית"
						}), /* @__PURE__ */ (0, x.jsx)("p", { children: "רק כאן נדרשת פעולה נוספת בסוכן החוזים. אין צורך במיפוי או בשיבוץ ללוח הזמנים." })] }), /* @__PURE__ */ (0, x.jsxs)("span", {
							className: "contractsDryBadge",
							children: [c.length, " החלטות"]
						})]
					}), c.length ? /* @__PURE__ */ (0, x.jsx)("div", {
						className: "contractsScheduleProjectionList",
						children: c.map((e) => /* @__PURE__ */ (0, x.jsx)(ti, { item: e }, e.decisionId))
					}) : /* @__PURE__ */ (0, x.jsx)("div", {
						className: "contractsMessage is-success",
						role: "status",
						children: "אין החלטות שממתינות להכרעת התאמה ל־Indicator."
					})]
				}),
				/* @__PURE__ */ (0, x.jsxs)("details", {
					className: "contractsRelationshipEvidence",
					children: [/* @__PURE__ */ (0, x.jsxs)("summary", { children: [
						"הצג ",
						l.length,
						" החלטות שאינן מתאימות למסירה"
					] }), /* @__PURE__ */ (0, x.jsx)("div", {
						className: "contractsScheduleProjectionList",
						children: l.map((e) => /* @__PURE__ */ (0, x.jsx)(ti, { item: e }, e.decisionId))
					})]
				})
			] })
		]
	});
}
function ri() {
	let [e, t] = (0, b.useState)(null), [n, r] = (0, b.useState)(null), [i, a] = (0, b.useState)(""), [o, s] = (0, b.useState)(null), [c, l] = (0, b.useState)(""), [u, d] = (0, b.useState)([]), [f, p] = (0, b.useState)(null), [m, h] = (0, b.useState)(""), [g, _] = (0, b.useState)([]), [v, y] = (0, b.useState)(null), [S, C] = (0, b.useState)(""), [w, T] = (0, b.useState)(null), [E, D] = (0, b.useState)(null), [O, k] = (0, b.useState)(""), [A, j] = (0, b.useState)(null), [M, N] = (0, b.useState)(null), [ee, P] = (0, b.useState)(null), [F, I] = (0, b.useState)(""), [te, L] = (0, b.useState)(null), [ne, re] = (0, b.useState)(null), [ie, R] = (0, b.useState)(""), [ae, oe] = (0, b.useState)(null), [se, ce] = (0, b.useState)(null), [le, ue] = (0, b.useState)(null), [de, fe] = (0, b.useState)(""), [pe, me] = (0, b.useState)(null), [he, ge] = (0, b.useState)(null), [_e, ve] = (0, b.useState)(""), [ye, be] = (0, b.useState)(null), [xe, Se] = (0, b.useState)(null), [Ce, we] = (0, b.useState)(""), [z, Te] = (0, b.useState)(""), [Ee, De] = (0, b.useState)(null), [Oe, ke] = (0, b.useState)(""), [Ae, je] = (0, b.useState)("idle"), [Me, Ne] = (0, b.useState)(""), [B, Pe] = (0, b.useState)(null), [Fe, Ie] = (0, b.useState)(null), [Le, Re] = (0, b.useState)(Tr), [ze, Be] = (0, b.useState)(Er), [Ve, He] = (0, b.useState)("אולם תצוגה הרצליה"), [V, Ue] = (0, b.useState)(null), [We, Ge] = (0, b.useState)(null), [Ke, qe] = (0, b.useState)("clauses"), [Je, Ye] = (0, b.useState)({}), [Xe, Ze] = (0, b.useState)(""), [Qe, $e] = (0, b.useState)(""), [et, tt] = (0, b.useState)(""), [nt, rt] = (0, b.useState)(null), [it, at] = (0, b.useState)(null), [H, U] = (0, b.useState)(""), [ot, st] = (0, b.useState)(""), ct = (0, b.useRef)(0), lt = (0, b.useRef)(null), ut = (0, b.useRef)(null), dt = (0, b.useRef)(null), ft = (0, b.useRef)(""), pt = (0, b.useRef)(0), mt = (0, b.useRef)(""), ht = (0, b.useRef)(!1);
	function gt(e) {
		return !!(e && e.epoch === ct.current && e.workspaceId === ft.current);
	}
	function _t() {
		lt.current && clearTimeout(lt.current), lt.current = null;
	}
	function vt(e) {
		if (!gt(e) || ht.current) return;
		_t();
		let t = Math.max(0, e.readyAt - Date.now());
		lt.current = setTimeout(() => {
			lt.current = null, yt();
		}, t);
	}
	async function yt() {
		if (ut.current || ht.current) return;
		let e = dt.current;
		if (!gt(e)) {
			dt.current = null;
			return;
		}
		if (dt.current = null, e.snapshot === mt.current) {
			je("saved"), Ne("");
			return;
		}
		let t = pt.current;
		ut.current = e, je("saving"), Ne("");
		try {
			let n = await G(`/api/contracts/workspaces/${e.workspaceId}/draft`, {
				method: "PUT",
				body: {
					...e.payload,
					expectedRevision: t
				}
			}), r = Number(n.saved?.revision);
			if (!Number.isSafeInteger(r) || r <= t) {
				let e = /* @__PURE__ */ Error("The saved draft revision is invalid.");
				throw e.code = "contracts_workspace_response_invalid", e;
			}
			if (gt(e)) {
				pt.current = r, mt.current = e.snapshot, De((t) => t?.workspaceId === e.workspaceId ? {
					...t,
					draft: {
						...t.draft || {},
						...e.payload,
						revision: r,
						updatedAt: n.saved?.updatedAt || (/* @__PURE__ */ new Date()).toISOString(),
						reviewedCount: n.saved?.reviewedCount,
						approvedCount: n.saved?.approvedCount,
						rejectedCount: n.saved?.rejectedCount
					}
				} : t);
				let t = dt.current;
				gt(t) && t.snapshot !== e.snapshot ? je("pending") : je("saved"), Tt();
			}
		} catch (t) {
			if (gt(e) && (t?.status === 409 || t?.code === "contracts_workspace_draft_stale")) {
				ht.current = !0, ct.current += 1, dt.current = null, _t();
				try {
					Vt((await G(`/api/contracts/workspaces/${e.workspaceId}`)).workspace, "", { autosaveConflictMessage: "הטיוטה השתנתה בחלון אחר. נטענה הגרסה העדכנית מהשרת; השינויים המקומיים שלא נשמרו לא הוחלו ולא דרסו החלטות חדשות יותר." });
				} catch {
					je("conflict"), Ne("זוהתה טיוטה חדשה יותר ולא בוצעה דריסה. לא ניתן היה לטעון אותה כעת; יש לפתוח מחדש את החוזה השמור לפני עריכה נוספת.");
				}
			} else gt(e) && (je("error"), Ne(W(t)));
		} finally {
			ut.current === e && (ut.current = null);
			let t = dt.current;
			gt(t) && !ht.current && vt(t);
		}
	}
	(0, b.useEffect)(() => {
		G("/api/contracts/review/status").then(t).catch((e) => st(W(e))), G("/api/contracts/activity-mapping/status").then(r).catch((e) => a(W(e))), G("/api/contracts/workspaces/status").then((e) => {
			s(e), e.ready && Tt(e);
		}).catch((e) => l(W(e))), G("/api/contracts/clauses/status").then((e) => {
			p(e), e.ready && Et(e);
		}).catch((e) => h(W(e))), G("/api/contracts/relationships/status").then(y).catch((e) => C(W(e))), G("/api/contracts/relationships/semantic/status").then(D).catch((e) => k(W(e))), G("/api/contracts/relationships/review/status").then(N).catch((e) => I(W(e))), G("/api/contracts/relationships/auto-review/status").then(L).catch((e) => R(W(e))), G("/api/contracts/decisions/status").then(oe).catch((e) => fe(W(e))), G("/api/contracts/decisions/auto-review/status").then(me).catch((e) => ve(W(e))), G("/api/contracts/decisions/lineage/status").then(ce).catch((e) => fe(W(e))), G("/api/contracts/decisions/indicator-handoff/status").then(be).catch((e) => we(W(e)));
	}, []), (0, b.useEffect)(() => {
		if (!o?.ready || !/^[0-9a-f-]{36}$/iu.test(Le.trim())) return;
		let e = setTimeout(() => Tt(), 350);
		return () => clearTimeout(e);
	}, [Le, o?.ready]), (0, b.useEffect)(() => {
		if (!f?.ready || !/^[0-9a-f-]{36}$/iu.test(Le.trim())) return;
		let e = setTimeout(() => Et(), 350);
		return () => clearTimeout(e);
	}, [Le, f?.ready]), (0, b.useEffect)(() => {
		!M?.ready || !z || At(z);
	}, [z, M?.ready]), (0, b.useEffect)(() => {
		!ae?.applyApproved || !z || jt(z);
	}, [
		z,
		ae?.applyApproved,
		se?.ready
	]), (0, b.useEffect)(() => {
		Se(null), we(""), re(null), R(""), ge(null), ve("");
	}, [z]), (0, b.useEffect)(() => {
		if (!o?.ready || !Ee?.workspaceId || !V || !Qe || !et || ht.current) return;
		let e = Lr({
			decisions: Je,
			reviewReason: Xe,
			batchId: Qe,
			reviewedAt: et,
			mappingDraft: B
		}), t = Rr(e), n = ut.current;
		if (t === mt.current && !gt(n)) {
			dt.current = null, _t(), je(Ee.draft ? "saved" : "idle"), Ne("");
			return;
		}
		let r = {
			epoch: ct.current,
			workspaceId: Ee.workspaceId,
			payload: e,
			snapshot: t,
			readyAt: Date.now() + 700
		};
		return dt.current = r, je("pending"), Ne(""), vt(r), _t;
	}, [
		Je,
		Xe,
		Qe,
		et,
		B,
		V?.document?.documentVersionId,
		Ee?.workspaceId,
		o?.ready
	]), (0, b.useEffect)(() => () => {
		ct.current += 1, dt.current = null, _t();
	}, []);
	let bt = V?.candidates?.length || 0, xt = V?.document?.documentVersionId || "", St = (0, b.useMemo)(() => Object.values(Je).filter((e) => e.action === "approve").length, [Je]), Ct = bt - St, wt = Sn(nt?.plan);
	async function Tt(e = o) {
		if (!(!e?.ready || !/^[0-9a-f-]{36}$/iu.test(Le.trim()))) try {
			d((await G(`/api/contracts/workspaces?${new URLSearchParams({
				sourceProjectId: Le.trim(),
				limit: "50"
			})}`)).items || []), l("");
		} catch (e) {
			d([]), l(W(e));
		}
	}
	async function Et(e = f) {
		if (!(!e?.ready || !/^[0-9a-f-]{36}$/iu.test(Le.trim()))) try {
			_((await G(`/api/contracts/clauses/workspaces?${new URLSearchParams({
				sourceProjectId: Le.trim(),
				limit: "50"
			})}`)).items || []), h("");
		} catch (e) {
			_([]), h(W(e));
		}
	}
	async function Dt(e) {
		U("open-clause-workspace"), h("");
		try {
			let t = await G(`/api/contracts/clauses/workspaces/${e}`, { timeoutMs: 6e4 });
			Ge(t.preview), qe("clauses"), Te(t.workspace?.workspaceId || e), T(null), j(null), k(""), P(null), I(""), ue(null), fe(""), ge(null), ve(""), Se(null), we(""), Ie(null), He(t.workspace?.projectSite || ""), ke("תוצאת סוכן החוזים נטענה מהשמירה ללא קריאה חוזרת למודל וללא המתנה לחילוץ."), st(""), v?.ready && await Ot(t.workspace?.workspaceId || e);
		} catch (e) {
			h(W(e));
		} finally {
			U("");
		}
	}
	async function Ot(e) {
		if (!(!v?.ready || !e)) try {
			T(await G(`/api/contracts/relationships/workspaces/${e}`, { timeoutMs: 6e4 })), C("");
		} catch (e) {
			T(null), C(W(e));
		}
	}
	async function kt() {
		if (!z) return C("יש לפתוח תחילה חילוץ סעיפים שמור.");
		if (!v?.ready) return C("שמירת קשרי R4.0 עדיין אינה מופעלת בשרת.");
		U("relationships-persist"), C("");
		try {
			T(await G(`/api/contracts/relationships/workspaces/${z}/explicit`, {
				method: "POST",
				timeoutMs: 6e4
			}));
		} catch (e) {
			C(W(e));
		} finally {
			U("");
		}
	}
	async function At(e) {
		if (!(!M?.ready || !e)) try {
			P(await G(`/api/contracts/relationships/workspaces/${e}/semantic-review`, { timeoutMs: 6e4 })), I("");
		} catch (e) {
			P(null), I(W(e));
		}
	}
	async function jt(e) {
		if (!(!ae?.applyApproved || !e)) try {
			ue(await G(se?.ready ? `/api/contracts/decisions/workspaces/${e}/lineage` : `/api/contracts/decisions/workspaces/${e}`, { timeoutMs: 6e4 })), fe(""), Se(null);
		} catch (e) {
			ue(null), fe(W(e));
		}
	}
	async function Mt() {
		if (!z) return we("יש לפתוח תחילה חילוץ סעיפים שמור.");
		if (!ye?.ready) return we("ערכת המסירה ל־Indicator עדיין אינה מופעלת בתהליך השרת הנוכחי.");
		U("indicator-handoff"), we(""), Se(null);
		try {
			Se(await G(`/api/contracts/decisions/workspaces/${z}/indicator-handoff`, { timeoutMs: 9e4 }));
		} catch (e) {
			we(W(e));
		} finally {
			U("");
		}
	}
	async function Nt() {
		if (!z) return k("יש לפתוח תחילה חילוץ סעיפים שמור.");
		if (!E?.ready) return k("תצוגת קשרי R4.1 עדיין אינה מופעלת או שמפתח המודל אינו מוגדר בשרת.");
		U("semantic-relationships"), k(""), j(null);
		try {
			let e = await G(M?.ready ? `/api/contracts/relationships/workspaces/${z}/semantic-proposals` : `/api/contracts/relationships/workspaces/${z}/semantic-preview`, {
				method: "POST",
				body: {},
				timeoutMs: 21e4
			});
			e.analysis && e.review ? (j(e.analysis), P(e.review), I(""), ae?.applyApproved && await jt(z)) : j(e);
		} catch (e) {
			k(W(e));
		} finally {
			U("");
		}
	}
	async function Pt(e, t, n) {
		if (!z || !e?.relationshipId) return I("הצעת הקשר השמורה אינה זמינה לסקירה.");
		U(`relationship-review:${e.relationshipId}`), I("");
		try {
			P(await G(`/api/contracts/relationships/workspaces/${z}/semantic-review/${e.relationshipId}`, {
				method: "POST",
				body: {
					expectedRevision: e.revision,
					action: t,
					reasonHe: n.reasonHe,
					...n.correction ? { correction: n.correction } : {}
				},
				timeoutMs: 6e4
			})), ae?.applyApproved && await jt(z);
		} catch (e) {
			I(W(e)), e?.status === 409 && await At(z);
		} finally {
			U("");
		}
	}
	async function Ft() {
		if (!z) return R("יש לפתוח תחילה חילוץ סעיפים שמור.");
		if (!te?.ready) return R("מיגרציית R4.2A.1 לאישור אוטומטי עדיין אינה זמינה ב־KAPAIM.");
		U("relationship-auto-review"), R(""), re(null);
		try {
			let e = await G(`/api/contracts/relationships/workspaces/${z}/semantic-auto-review`, {
				method: "POST",
				body: {},
				timeoutMs: 6e4
			});
			re(e), P(e.review), ae?.applyApproved && await jt(z);
		} catch (e) {
			R(W(e)), e?.status === 409 && await At(z);
		} finally {
			U("");
		}
	}
	async function It() {
		if (!z) return fe("יש לפתוח תחילה חילוץ סעיפים שמור.");
		if (!ae?.ready) return fe("R4.2B עדיין אינו מופעל או שמפתח המודל אינו מוגדר בשרת.");
		if (Number(le?.metrics?.pendingRelationshipCount || 0) > 0) return fe("יש לסיים תחילה את סקירת כל הקשרים השמורים.");
		U("decision-proposals"), fe("");
		try {
			ue((await G(`/api/contracts/decisions/workspaces/${z}/proposals`, {
				method: "POST",
				body: {},
				timeoutMs: 27e4
			})).review), Se(null);
		} catch (e) {
			fe(W(e)), e?.status === 409 && await jt(z);
		} finally {
			U("");
		}
	}
	async function Lt() {
		if (!z) return ve("יש לפתוח תחילה חילוץ סעיפים שמור.");
		if (!pe?.ready) return ve("R4.2B.1 עדיין אינו מופעל או שמפתח המודל אינו מוגדר בשרת.");
		if (!(Number(le?.metrics?.proposedCount || 0) < 1)) {
			U("decision-auto-review"), ve(""), ge(null);
			try {
				ge(await G(`/api/contracts/decisions/workspaces/${z}/auto-review`, {
					method: "POST",
					body: {},
					timeoutMs: 3e5
				})), Se(null), await jt(z);
			} catch (e) {
				ve(W(e)), e?.status === 409 && await jt(z);
			} finally {
				U("");
			}
		}
	}
	async function Rt(e, t, n) {
		if (!z || !e?.decisionId) return fe("הצעת ההחלטה השמורה אינה זמינה לסקירה.");
		U(`decision-review:${e.decisionId}`), fe("");
		try {
			ue(await G(`/api/contracts/decisions/workspaces/${z}/review/${e.decisionId}`, {
				method: "POST",
				body: {
					expectedRevision: e.revision,
					action: t,
					reasonHe: n.reasonHe,
					...n.correction ? { correction: n.correction } : {}
				},
				timeoutMs: 6e4
			})), Se(null);
		} catch (e) {
			fe(W(e)), e?.status === 409 && await jt(z);
		} finally {
			U("");
		}
	}
	async function zt(e, t) {
		if (!z || !e?.decisionId || !se?.ready) return fe("פעולת הפיצול של R4.2C אינה זמינה כעת.");
		U(`decision-lineage:${e.decisionId}`), fe("");
		try {
			ue(await G(`/api/contracts/decisions/workspaces/${z}/lineage/split/${e.decisionId}`, {
				method: "POST",
				body: t,
				timeoutMs: 6e4
			})), Se(null);
		} catch (e) {
			fe(W(e)), e?.status === 409 && await jt(z);
		} finally {
			U("");
		}
	}
	async function Bt(e) {
		if (!z || !se?.ready) return fe("פעולת המיזוג של R4.2C אינה זמינה כעת.");
		U("decision-lineage:merge"), fe("");
		try {
			ue(await G(`/api/contracts/decisions/workspaces/${z}/lineage/merge`, {
				method: "POST",
				body: e,
				timeoutMs: 6e4
			})), Se(null);
		} catch (e) {
			fe(W(e)), e?.status === 409 && await jt(z);
		} finally {
			U("");
		}
	}
	function Vt(e, t = "", { autosaveConflictMessage: n = "", preserveClausePreview: r = !1, preserveFile: i = !1 } = {}) {
		let a = e.extraction, o = Ir(a, e.draft), s = Lr(o);
		_t(), ct.current += 1, dt.current = null, ht.current = !!n, ft.current = e.workspaceId, pt.current = zr(e.draft), mt.current = Rr(s), je(n ? "conflict" : e.draft ? "saved" : "idle"), Ne(n), Ue(a), Ye(o.decisions), Ze(o.reviewReason), $e(o.batchId), tt(o.reviewedAt), Pe(o.mappingDraft), Re(e.sourceProjectId || a.projectBinding?.projectId || Tr), Be(e.scheduleProjectId || Er), He(e.projectSite || a.projectBinding?.projectSite || ""), De(e), ke(t), rt(null), at(null), st(""), r || Ge(null), i || Ie(null);
	}
	async function Ht(e) {
		U("open-workspace"), l("");
		try {
			Vt((await G(`/api/contracts/workspaces/${e}`)).workspace, "החוזה והחלטות הטיוטה נטענו ללא קריאה חדשה למודל.");
		} catch (e) {
			l(W(e));
		} finally {
			U("");
		}
	}
	function Ut(e, t) {
		Ye((n) => ({
			...n,
			[e]: {
				...n[e],
				...t
			}
		})), rt(null), at(null);
	}
	function Wt() {
		if (!V) return "יש להריץ חילוץ לפני סקירה.";
		if (Xe.trim().length < 10) return "נדרש נימוק סקירה כללי של לפחות 10 תווים.";
		for (let e of V.candidates || []) {
			let t = Je[e.candidateKey];
			if (!t?.reason?.trim()) return "נדרש נימוק לכל החלטה.";
			if (t.action === "approve" && !t.gatesReviewed) return "יש לאשר במפורש שהחסמים נבדקו לכל מועמד שמקודם.";
			if (t.action === "approve" && e.conflictGroupId && !t.conflictReason.trim()) return "נדרש נימוק מפורש לפתרון סתירה.";
		}
		return "";
	}
	async function Gt() {
		if (!Fe) return st("יש לבחור קובץ PDF.");
		U("extract"), st(""), l(""), ke(""), rt(null), at(null);
		try {
			let e = await jr(Fe), t = {
				filename: Fe.name,
				mediaType: "application/pdf",
				pdfBase64: e,
				mode: "dry_run",
				projectSelection: {
					projectId: Le.trim(),
					projectSite: Ve.trim(),
					selectedByUser: !0
				}
			}, n = o?.ready ? await G("/api/contracts/workspaces/extract", {
				method: "POST",
				timeoutMs: 3e5,
				body: {
					extractionRequest: t,
					scheduleProjectId: ze.trim()
				}
			}) : await G("/api/contracts/extract", {
				method: "POST",
				timeoutMs: 3e5,
				body: t
			}), r = n.extraction || n, i = Ir(r, n.draft);
			if (o?.ready) {
				let e = n.reused ? "החוזה כבר היה שמור: החילוץ והטיוטה נטענו ללא קריאת מודל וללא עלות טוקנים נוספת." : "החוזה, ה-PDF ותוצאת החילוץ נשמרו. השינויים בהחלטות יישמרו אוטומטית.";
				Vt({
					...n.workspace,
					extraction: r,
					draft: n.draft || null
				}, e, {
					preserveClausePreview: !0,
					preserveFile: !0
				}), Tt();
			} else ft.current = "", pt.current = 0, mt.current = "", De(null), Ue(r), Ye(i.decisions), $e(i.batchId), tt(i.reviewedAt), Ze(i.reviewReason), Pe(i.mappingDraft), ke("השמירה הקבועה עדיין אינה מופעלת בשרת; החילוץ נשמר רק במסך הנוכחי.");
		} catch (e) {
			st(W(e));
		} finally {
			U("");
		}
	}
	async function Kt() {
		if (!Fe) return st("יש לבחור קובץ PDF.");
		if (!f?.ready) return st("שמירת תוצאת סוכן החוזים עדיין אינה מופעלת בשרת.");
		U("clause-persist"), st(""), ke("");
		try {
			let e = await jr(Fe), t = await G("/api/contracts/clauses/workspaces/extract", {
				method: "POST",
				timeoutMs: 3e5,
				body: {
					filename: Fe.name,
					mediaType: "application/pdf",
					pdfBase64: e,
					mode: "persist",
					projectSelection: {
						projectId: Le.trim(),
						projectSite: Ve.trim(),
						selectedByUser: !0
					}
				}
			});
			Ge(t), qe("clauses"), Te(t.workspace?.workspaceId || ""), T(null), C(""), j(null), k(""), P(null), I(""), ke(t.modelAvoided ? "החילוץ הזה כבר היה שמור ונטען מיד, ללא קריאה חוזרת למודל." : "ה־PDF וכל תוצאת סוכן החוזים נשמרו. מעכשיו אפשר לפתוח אותם מחדש ללא חילוץ חוזר."), Et();
		} catch (e) {
			st(W(e));
		} finally {
			U("");
		}
	}
	async function qt() {
		let e = Wt();
		if (e) return st(e);
		U("plan"), st("");
		try {
			rt(await G("/api/contracts/review/plan", {
				method: "POST",
				body: Hr({
					extraction: V,
					decisions: Je,
					reviewReason: Xe,
					batchId: Qe,
					reviewedAt: et,
					sourceProjectId: Le,
					scheduleProjectId: ze
				})
			})), at(null);
		} catch (e) {
			st(W(e));
		} finally {
			U("");
		}
	}
	async function Jt(e) {
		if (!nt) return st("יש להכין ולאמת את תוכנית הסקירה לפני השמירה או הקידום.");
		if (e !== wt || e === xn.blocked) return st("תוכנית הסקירה אינה מוכנה לפעולה בטוחה.");
		let t = e === xn.reviewOnly;
		U(t ? "save-review" : "commit"), st("");
		try {
			let e = Hr({
				extraction: V,
				decisions: Je,
				reviewReason: Xe,
				batchId: Qe,
				reviewedAt: et,
				sourceProjectId: Le,
				scheduleProjectId: ze
			});
			at(await G(t ? "/api/contracts/review/save" : "/api/contracts/review/commit", {
				method: "POST",
				body: t ? {
					...e,
					persistReview: !0
				} : {
					...e,
					commit: !0
				}
			}));
		} catch (e) {
			st(W(e));
		} finally {
			U("");
		}
	}
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		className: "contractsPage",
		children: [
			/* @__PURE__ */ (0, x.jsxs)("header", {
				className: "contractsHero",
				children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [
					/* @__PURE__ */ (0, x.jsx)("p", {
						className: "contractsEyebrow",
						children: "סוכן חוזים · R3.2 + שלב 2 + שלב 3F + שלב 3F.1"
					}),
					/* @__PURE__ */ (0, x.jsx)("h1", { children: "חילוץ, סקירה וקישור עובדות חוזיות ללוח" }),
					/* @__PURE__ */ (0, x.jsx)("p", { children: "עובדות ומיפויי פעילות אינם משפיעים על מנוע הלו״ז לפני סקירה אנושית, פתרון חסמים וכתיבה אטומית מאושרת." })
				] }), /* @__PURE__ */ (0, x.jsxs)("div", {
					className: "contractsModeStack",
					children: [
						/* @__PURE__ */ (0, x.jsxs)("div", {
							className: `contractsMode ${e?.applyApproved ? "is-ready" : "is-paused"}`,
							children: [/* @__PURE__ */ (0, x.jsx)("strong", { children: e?.applyApproved ? "קידום עובדות פעיל" : "קידום עובדות מושבת" }), /* @__PURE__ */ (0, x.jsxs)("span", { children: ["שלב 2 · גרסת תשתית ", e?.migrationVersion || "—"] })]
						}),
						/* @__PURE__ */ (0, x.jsxs)("div", {
							className: `contractsMode ${n?.reviewApplyApproved ? "is-ready" : "is-paused"}`,
							children: [/* @__PURE__ */ (0, x.jsx)("strong", { children: n?.reviewApplyApproved ? "ביקורת מיפוי פעילה" : "ביקורת מיפוי לקריאה בלבד" }), /* @__PURE__ */ (0, x.jsxs)("span", { children: ["שלב 3F · גרסת תשתית ", n?.historyMigrationVersion || "—"] })]
						}),
						/* @__PURE__ */ (0, x.jsxs)("div", {
							className: `contractsMode ${o?.ready ? "is-ready" : "is-paused"}`,
							children: [/* @__PURE__ */ (0, x.jsx)("strong", { children: o?.ready ? "שמירת חוזים פעילה" : "שמירת חוזים ממתינה להפעלה" }), /* @__PURE__ */ (0, x.jsxs)("span", { children: ["שלב 3F.1 · גרסת תשתית ", o?.migrationVersion || "—"] })]
						}),
						/* @__PURE__ */ (0, x.jsxs)("div", {
							className: `contractsMode ${f?.ready ? "is-ready" : "is-paused"}`,
							children: [/* @__PURE__ */ (0, x.jsx)("strong", { children: f?.ready ? "שמירת כל סעיפי החוזה פעילה" : "שמירת כל הסעיפים ממתינה להפעלה" }), /* @__PURE__ */ (0, x.jsxs)("span", { children: ["R3.2 · גרסת תשתית ", f?.migrationVersion || "—"] })]
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, x.jsxs)("section", {
				className: "contractsPanel contractsWorkspacePanel contractsClauseWorkspacePanel",
				children: [
					/* @__PURE__ */ (0, x.jsxs)("div", {
						className: "contractsSectionHeader",
						children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("h2", { children: "חילוצי סוכן החוזים שנשמרו" }), /* @__PURE__ */ (0, x.jsx)("p", { children: "פתיחה מכאן טוענת את כל הסעיפים, התקצירים, התגיות וההפניות ללא העלאת PDF וללא קריאה נוספת למודל." })] }), /* @__PURE__ */ (0, x.jsx)("span", {
							className: f?.ready ? "contractsPlanReady" : "contractsPlanBlocked",
							children: f?.ready ? "שמירת R3.2 פעילה" : "שמירת R3.2 מושבתת"
						})]
					}),
					!f?.ready && /* @__PURE__ */ (0, x.jsx)("p", {
						className: "contractsActivationNotice",
						children: m || "מיגרציית R3.2 והפעלת השרת עדיין נדרשות לפני שמירת חילוצי הסעיפים."
					}),
					f?.ready && g.length === 0 && /* @__PURE__ */ (0, x.jsx)("p", {
						className: "contractsMappingEmpty",
						children: "אין עדיין חילוצי סעיפים שמורים לפרויקט MAIN הנבחר."
					}),
					f?.ready && g.length > 0 && /* @__PURE__ */ (0, x.jsx)("div", {
						className: "contractsSavedList",
						"aria-label": "חילוצי סעיפים שמורים",
						children: g.map((e) => /* @__PURE__ */ (0, x.jsxs)("article", { children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [
							/* @__PURE__ */ (0, x.jsx)("strong", { children: e.projectSite || e.filename }),
							/* @__PURE__ */ (0, x.jsxs)("span", { children: [
								e.filename,
								" · ",
								e.clauseCount,
								" רשומות · ",
								e.pageCount,
								" עמודים"
							] }),
							/* @__PURE__ */ (0, x.jsxs)("small", { children: ["נשמר ", wr(e.createdAt)] }),
							/* @__PURE__ */ (0, x.jsx)("small", {
								dir: "ltr",
								children: e.documentVersionId
							})
						] }), /* @__PURE__ */ (0, x.jsx)("button", {
							type: "button",
							disabled: !!H,
							onClick: () => Dt(e.workspaceId),
							children: H === "open-clause-workspace" ? "פותח…" : "פתח ללא חילוץ חוזר"
						})] }, e.workspaceId))
					}),
					f?.ready && m && /* @__PURE__ */ (0, x.jsx)("div", {
						className: "contractsMessage is-error",
						role: "alert",
						children: m
					})
				]
			}),
			/* @__PURE__ */ (0, x.jsxs)("section", {
				className: "contractsPanel contractsWorkspacePanel",
				children: [
					/* @__PURE__ */ (0, x.jsxs)("div", {
						className: "contractsSectionHeader",
						children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("h2", { children: "חוזים שמורים — חילוץ קלאסי והמשך עבודה" }), /* @__PURE__ */ (0, x.jsx)("p", { children: "פתיחה מחדש אינה שולחת את ה-PDF למודל. כל גרסת מסמך נשמרת בנפרד והחלטות אינן מועתקות אוטומטית לגרסה חדשה." })] }), /* @__PURE__ */ (0, x.jsx)("span", {
							className: o?.ready ? "contractsPlanReady" : "contractsPlanBlocked",
							children: o?.ready ? "שמירה אוטומטית פעילה" : "שמירה קבועה מושבתת"
						})]
					}),
					!o?.ready && /* @__PURE__ */ (0, x.jsx)("p", {
						className: "contractsActivationNotice",
						children: c || "המיגרציה ודלי האחסון הפרטי עדיין לא הופעלו בשרת. אפשר להמשיך בחילוץ יבש, אך רענון הדף יאבד את הטיוטה."
					}),
					o?.ready && u.length === 0 && /* @__PURE__ */ (0, x.jsx)("p", {
						className: "contractsMappingEmpty",
						children: "אין עדיין חוזים שמורים לפרויקט MAIN הנבחר."
					}),
					o?.ready && u.length > 0 && /* @__PURE__ */ (0, x.jsx)("div", {
						className: "contractsSavedList",
						"aria-label": "חוזים שמורים",
						children: u.map((e) => /* @__PURE__ */ (0, x.jsxs)("article", { children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [
							/* @__PURE__ */ (0, x.jsx)("strong", { children: e.projectSite || e.filename }),
							/* @__PURE__ */ (0, x.jsxs)("span", { children: [
								e.filename,
								" · ",
								e.candidateCount,
								" מועמדים"
							] }),
							/* @__PURE__ */ (0, x.jsx)("small", { children: e.draft ? `${e.draft.reviewedCount}/${e.candidateCount} החלטות עם נימוק · נשמר ${wr(e.draft.updatedAt)}` : `טרם נשמרה טיוטת החלטות · נוצר ${wr(e.createdAt)}` }),
							/* @__PURE__ */ (0, x.jsxs)("small", { children: ["מזהה פרויקט לוח זמנים: ", /* @__PURE__ */ (0, x.jsx)("bdi", {
								dir: "ltr",
								children: e.scheduleProjectId || "לא שויך"
							})] }),
							/* @__PURE__ */ (0, x.jsx)("small", {
								dir: "ltr",
								children: e.documentVersionId
							})
						] }), /* @__PURE__ */ (0, x.jsx)("button", {
							type: "button",
							disabled: !!H,
							onClick: () => Ht(e.workspaceId),
							children: H === "open-workspace" ? "פותח…" : "פתח והמשך"
						})] }, e.workspaceId))
					}),
					o?.ready && c && /* @__PURE__ */ (0, x.jsx)("div", {
						className: "contractsMessage is-error",
						role: "alert",
						children: c
					})
				]
			}),
			/* @__PURE__ */ (0, x.jsxs)("section", {
				className: "contractsPanel",
				children: [
					/* @__PURE__ */ (0, x.jsx)("h2", { children: "1. חוזה וקישור פרויקט" }),
					/* @__PURE__ */ (0, x.jsxs)("div", {
						className: "contractsFieldGrid",
						children: [
							/* @__PURE__ */ (0, x.jsxs)("label", { children: ["קובץ PDF", /* @__PURE__ */ (0, x.jsx)("input", {
								type: "file",
								accept: "application/pdf,.pdf",
								onChange: (e) => {
									Ie(e.target.files?.[0] || null), Ge(null), qe("clauses"), Te(""), T(null), C(""), j(null), k(""), P(null), I(""), ue(null), fe(""), ge(null), ve(""), Se(null), we("");
								}
							})] }),
							/* @__PURE__ */ (0, x.jsxs)("label", { children: ["אתר / תיאור פרויקט", /* @__PURE__ */ (0, x.jsx)("input", {
								value: Ve,
								onChange: (e) => He(e.target.value)
							})] }),
							/* @__PURE__ */ (0, x.jsxs)("label", { children: ["מזהה פרויקט מקור ב־MAIN", /* @__PURE__ */ (0, x.jsx)("input", {
								dir: "ltr",
								value: Le,
								onChange: (e) => Re(e.target.value)
							})] }),
							/* @__PURE__ */ (0, x.jsxs)("label", { children: ["מזהה פרויקט לוח זמנים ב־KAPAIM", /* @__PURE__ */ (0, x.jsx)("input", {
								dir: "ltr",
								value: ze,
								onChange: (e) => Be(e.target.value)
							})] })
						]
					}),
					/* @__PURE__ */ (0, x.jsxs)("div", {
						className: "contractsUploadActions",
						children: [/* @__PURE__ */ (0, x.jsx)("button", {
							type: "button",
							className: "contractsPrimary",
							disabled: !!H || !f?.ready,
							onClick: Kt,
							children: H === "clause-persist" ? "מפרק, מעשיר ושומר את כל סעיפי החוזה…" : "חלץ ושמור את כל תוצאת סוכן החוזים"
						}), /* @__PURE__ */ (0, x.jsx)("button", {
							type: "button",
							className: "contractsSecondary",
							disabled: !!H,
							onClick: Gt,
							children: H === "extract" ? "בודק אם החוזה שמור, ומחלץ רק אם נדרש…" : o?.ready ? "הרץ גם את החילוץ הקלאסי ושמור" : "הרץ גם את החילוץ הקלאסי"
						})]
					}),
					/* @__PURE__ */ (0, x.jsx)("p", {
						className: "contractsFieldHint",
						children: "תוצאת הסעיפים נשמרת ב־KAPAIM ובאחסון הפרטי וניתנת לפתיחה מחדש ללא חילוץ חוזר. לאחר הפתיחה סוכן הקשרים מציג את ההפניות המפורשות בנפרד. הכפתור השני משאיר את מסלול החילוץ הקלאסי זמין להשוואה."
					}),
					Oe && /* @__PURE__ */ (0, x.jsx)("div", {
						className: "contractsMessage is-success",
						role: "status",
						children: Oe
					})
				]
			}),
			We && /* @__PURE__ */ (0, x.jsxs)("section", {
				className: "contractsWorkspaceTabsShell",
				"aria-labelledby": "contracts-open-workspace-title",
				children: [
					/* @__PURE__ */ (0, x.jsxs)("div", {
						className: "contractsWorkspaceTabsHeader",
						children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [
							/* @__PURE__ */ (0, x.jsx)("p", {
								className: "contractsEyebrow",
								children: "חוזה פתוח · סביבת עבודה שמורה"
							}),
							/* @__PURE__ */ (0, x.jsx)("h2", {
								id: "contracts-open-workspace-title",
								children: Ve || We.document?.filename || "חוזה שמור"
							}),
							/* @__PURE__ */ (0, x.jsxs)("p", { children: [We.document?.filename || "", " · בחרו שלב כדי להציג רק את המידע הרלוונטי."] })
						] }), /* @__PURE__ */ (0, x.jsx)("span", {
							className: "contractsPlanReady",
							children: "החילוץ השמור נשאר טעון בעת מעבר בין הכרטיסיות"
						})]
					}),
					/* @__PURE__ */ (0, x.jsx)(kr, {
						activeTab: Ke,
						onChange: qe
					}),
					/* @__PURE__ */ (0, x.jsx)(Ar, {
						id: "clauses",
						activeTab: Ke,
						children: /* @__PURE__ */ (0, x.jsx)(Wr, {
							preview: We,
							classicDocumentVersionId: xt
						})
					}),
					/* @__PURE__ */ (0, x.jsx)(Ar, {
						id: "relationships",
						activeTab: Ke,
						children: /* @__PURE__ */ (0, x.jsx)(Jr, {
							preview: We,
							workspaceId: z,
							persistenceStatus: v,
							persistenceResult: w,
							persistenceError: S,
							persistenceBusy: H === "relationships-persist",
							onPersist: kt,
							semanticStatus: E,
							semanticResult: A,
							semanticError: O,
							semanticBusy: H === "semantic-relationships",
							onRunSemantic: Nt,
							reviewStatus: M,
							reviewResult: ee,
							reviewError: F,
							reviewBusyId: H.startsWith("relationship-review:") ? H.slice(20) : "",
							onReview: Pt,
							autoReviewStatus: te,
							autoReviewResult: ne,
							autoReviewError: ie,
							autoReviewBusy: H === "relationship-auto-review",
							onAutoReview: Ft
						})
					}),
					/* @__PURE__ */ (0, x.jsx)(Ar, {
						id: "decisions",
						activeTab: Ke,
						children: /* @__PURE__ */ (0, x.jsx)(ei, {
							status: ae,
							lineageStatus: se,
							result: le,
							autoReviewStatus: pe,
							autoReviewResult: he,
							autoReviewError: _e,
							autoReviewBusy: H === "decision-auto-review",
							relationshipPendingCount: ee?.metrics?.proposedCount || 0,
							error: de,
							generationBusy: H === "decision-proposals",
							reviewBusyId: H.startsWith("decision-review:") ? H.slice(16) : H === "decision-lineage:merge" ? "lineage:merge" : H.startsWith("decision-lineage:") ? `lineage:${H.slice(17)}` : "",
							onGenerate: It,
							onAutoReview: Lt,
							onSplit: zt,
							onMerge: Bt,
							onReview: Rt
						})
					}),
					/* @__PURE__ */ (0, x.jsx)(Ar, {
						id: "indicator",
						activeTab: Ke,
						children: /* @__PURE__ */ (0, x.jsx)(ni, {
							status: ye,
							result: xe,
							error: Ce,
							busy: H === "indicator-handoff",
							disabled: !!H,
							onRun: Mt
						})
					})
				]
			}),
			V && /* @__PURE__ */ (0, x.jsxs)("section", {
				className: "contractsPanel",
				children: [
					/* @__PURE__ */ (0, x.jsxs)("div", {
						className: "contractsSectionHeader",
						children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [
							/* @__PURE__ */ (0, x.jsx)("p", {
								className: "contractsEyebrow",
								children: "חילוץ קלאסי · תצוגת השוואה"
							}),
							/* @__PURE__ */ (0, x.jsx)("h2", { children: "תוצאת הסוכן הקלאסי: סקירת מועמדים" }),
							/* @__PURE__ */ (0, x.jsxs)("p", { children: [
								bt,
								" מועמדים · ",
								St,
								" לאישור · ",
								Ct,
								" לדחייה"
							] })
						] }), /* @__PURE__ */ (0, x.jsxs)("div", {
							className: "contractsWorkspaceSaveState",
							role: "status",
							children: [/* @__PURE__ */ (0, x.jsx)("span", {
								className: "contractsDryBadge",
								children: "חילוץ יבש · ללא כתיבה ללוח"
							}), Ee?.workspaceId && /* @__PURE__ */ (0, x.jsx)("span", {
								className: `contractsAutosave is-${Ae}`,
								children: Ae === "saving" || Ae === "pending" ? "שומר טיוטה…" : Ae === "conflict" ? "זוהתה טיוטה חדשה יותר" : Ae === "idle" ? "טרם בוצעו שינויים בטיוטה" : Ae === "error" ? "השמירה האוטומטית נכשלה" : "כל שינויי הטיוטה נשמרו"
							})]
						})]
					}),
					Me && /* @__PURE__ */ (0, x.jsx)("div", {
						className: "contractsMessage is-error",
						role: "alert",
						children: Me
					}),
					/* @__PURE__ */ (0, x.jsx)("div", {
						className: "contractsCandidateList",
						children: (V.candidates || []).map((e) => /* @__PURE__ */ (0, x.jsx)(Ur, {
							candidate: e,
							decision: Je[e.candidateKey],
							onChange: (t) => Ut(e.candidateKey, t)
						}, e.candidateKey))
					}),
					/* @__PURE__ */ (0, x.jsxs)("label", {
						className: "contractsReviewReason",
						children: ["נימוק סקירה כללי", /* @__PURE__ */ (0, x.jsx)("textarea", {
							rows: "3",
							value: Xe,
							onChange: (e) => {
								Ze(e.target.value), rt(null);
							}
						})]
					}),
					/* @__PURE__ */ (0, x.jsx)("button", {
						type: "button",
						className: "contractsPrimary",
						disabled: !!H,
						onClick: qt,
						children: H === "plan" ? "בודק תוכנית…" : "הכן ובדוק תוכנית קידום"
					})
				]
			}),
			nt && /* @__PURE__ */ (0, x.jsxs)("section", {
				className: "contractsPanel contractsPlanPanel",
				children: [
					/* @__PURE__ */ (0, x.jsxs)("div", {
						className: "contractsSectionHeader",
						children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("h2", { children: "3. תוכנית טרנזקציה" }), /* @__PURE__ */ (0, x.jsxs)("p", { children: [
							"מצב: ",
							gr(nt.plan?.status),
							" · פעולה בטוחה: ",
							wt === xn.promotion ? "קידום עובדות מאושרות" : wt === xn.reviewOnly ? "שמירת סקירה בלבד" : "אין"
						] })] }), /* @__PURE__ */ (0, x.jsx)("span", {
							className: wt === xn.blocked ? "contractsPlanBlocked" : "contractsPlanReady",
							children: wt === xn.promotion ? "מוכן לקידום" : wt === xn.reviewOnly ? "מוכן לשמירת סקירה" : "חסום"
						})]
					}),
					(nt.plan?.globalBlockers || []).length > 0 && /* @__PURE__ */ (0, x.jsx)("ul", {
						className: "contractsBlockers",
						children: nt.plan.globalBlockers.map((e) => /* @__PURE__ */ (0, x.jsx)("li", { children: ur(e) }, e))
					}),
					/* @__PURE__ */ (0, x.jsxs)("div", {
						className: "contractsPlanCounts",
						children: [
							/* @__PURE__ */ (0, x.jsxs)("span", { children: ["אבני דרך ", /* @__PURE__ */ (0, x.jsx)("strong", { children: nt.plan?.rowsByTable?.schedule_contract_milestones?.length || 0 })] }),
							/* @__PURE__ */ (0, x.jsxs)("span", { children: ["הארכות ", /* @__PURE__ */ (0, x.jsx)("strong", { children: nt.plan?.rowsByTable?.schedule_contract_extensions?.length || 0 })] }),
							/* @__PURE__ */ (0, x.jsxs)("span", { children: ["תנאים ", /* @__PURE__ */ (0, x.jsx)("strong", { children: nt.plan?.rowsByTable?.schedule_contract_conditions?.length || 0 })] })
						]
					}),
					wt === xn.reviewOnly && /* @__PURE__ */ (0, x.jsxs)("div", {
						className: "contractsActionBlock",
						children: [
							/* @__PURE__ */ (0, x.jsx)("p", { children: "כל המועמדים נדחו. הפעולה תשמור ביקורת בלתי־ניתנת לשינוי בלבד ותיצור אפס רשומות לו״ז." }),
							!e?.applyApproved && /* @__PURE__ */ (0, x.jsx)("p", {
								className: "contractsActivationNotice",
								children: "שמירת ביקורות מושבתת בצד השרת. שינוי תשתית הנתונים אינו נבדק או מופעל מכפתור זה."
							}),
							/* @__PURE__ */ (0, x.jsx)("button", {
								type: "button",
								className: "contractsCommit contractsReviewOnlyAction",
								disabled: !!H || !e?.applyApproved,
								onClick: () => Jt(xn.reviewOnly),
								children: H === "save-review" ? "שומר סקירה ללא קידום…" : "שמור סקירה ללא קידום"
							})
						]
					}),
					wt === xn.promotion && /* @__PURE__ */ (0, x.jsxs)("div", {
						className: "contractsActionBlock",
						children: [
							/* @__PURE__ */ (0, x.jsx)("p", { children: "רק העובדות שאושרו ועמדו בכל החסמים ייכתבו אטומית לטבלאות הלו״ז הקיימות." }),
							!e?.applyApproved && /* @__PURE__ */ (0, x.jsx)("p", {
								className: "contractsActivationNotice",
								children: "קידום עובדות מושבת בצד השרת. נדרש אישור הפעלה נפרד."
							}),
							/* @__PURE__ */ (0, x.jsx)("button", {
								type: "button",
								className: "contractsCommit",
								disabled: !!H || !e?.applyApproved,
								onClick: () => Jt(xn.promotion),
								children: H === "commit" ? "מבצע קידום אטומי…" : "קדם עובדות מאושרות"
							})
						]
					}),
					wt === xn.blocked && /* @__PURE__ */ (0, x.jsxs)("div", {
						className: "contractsActionBlock",
						children: [/* @__PURE__ */ (0, x.jsx)("p", {
							className: "contractsActivationNotice",
							children: "התוכנית כוללת החלטה חסרה או מועמד שאושר אך עדיין אינו בטוח לקידום. יש לחזור לסקירה ולפתור את החסמים."
						}), /* @__PURE__ */ (0, x.jsx)("button", {
							type: "button",
							className: "contractsCommit",
							disabled: !0,
							children: "נדרשת השלמת חסמים"
						})]
					})
				]
			}),
			V && /* @__PURE__ */ (0, x.jsx)(Vr, {
				extraction: V,
				sourceProjectId: Le.trim(),
				status: n,
				statusError: i,
				savedState: B,
				savedStateKey: Ee?.workspaceId || "",
				onDraftStateChange: Pe
			}),
			ot && /* @__PURE__ */ (0, x.jsx)("div", {
				className: "contractsMessage is-error",
				role: "alert",
				children: ot
			}),
			it && /* @__PURE__ */ (0, x.jsx)("div", {
				className: "contractsMessage is-success",
				children: it.status === "reviewed_no_promotion" ? "הסקירה נשמרה ביומן הביקורת בלבד. לא קודמו ולא נוצרו רשומות לו״ז." : `הקידום הושלם. קודמו ${it.promotedCount} רשומות.`
			})
		]
	});
}
//#endregion
//#region src/react/main.jsx
var ii = /* @__PURE__ */ new WeakMap();
function ai({ label: e = "React bridge ready" }) {
	return /* @__PURE__ */ (0, x.jsx)("span", {
		className: "reactBridgeStatus",
		"data-react-ready": "true",
		children: e
	});
}
var oi = {
	status: ai,
	settings: B,
	workflow: ze,
	insights: tt,
	schedule: bn,
	contracts: ri
};
function si(e) {
	let t = oi[e.dataset.reactIsland];
	if (!t || ii.has(e)) return !1;
	let n = e.dataset.reactProps ? JSON.parse(e.dataset.reactProps) : {}, r = (0, y.createRoot)(e);
	return r.render(/* @__PURE__ */ (0, x.jsx)(b.StrictMode, { children: /* @__PURE__ */ (0, x.jsx)(t, { ...n }) })), ii.set(e, r), !0;
}
function ci(e = document) {
	return Array.from(e.querySelectorAll("[data-react-island]")).reduce((e, t) => e + +!!si(t), 0);
}
typeof window < "u" && (window.BiDocReact = {
	islands: Object.keys(oi),
	mountReactIslands: ci,
	version: "0.1.0"
}, document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", () => ci(), { once: !0 }) : ci());
//#endregion
export { ci as mountReactIslands };
