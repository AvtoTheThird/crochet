/** Shared application state */
export const state = {
	originalImg: null,
	workingCanvas: null,
	workingCtx: null,
	baseDisplayScale: 1,
	displayScale: 1,
	zoomLevel: 1,
	currentStep: 1,
	showCountOverlay: true,
	startDirection: 'ltr',

	projectId: null,
	projectName: null,
	loadedFileName: null,
	/** @type {number[]} */
	completedRows: [],

	cropRect: { x: 0, y: 0, w: 0, h: 0 },

	pixelData: null,
	countResults: [],
	countGrid: [],
	countMetrics: null,

	/** @type {Map<string, {id:string,r:number,g:number,b:number,hex:string,name:string}>} */
	yarnColors: new Map(),
	/** source hex -> yarn id */
	sourceToYarn: new Map(),
	highlightedSourceHex: null,

	viewPanning: null,
	cropDragging: null,

	patternWalk: {
		steps: [],
		currentIndex: 0,
		sidebarOpen: true,
		options: {
			highlightRow: true,
			enlargeSegment: true,
			dimOtherRows: true,
			showGrid: true,
			showCountNumbers: false
		}
	}
};

export const STEP_COUNT = 6;
