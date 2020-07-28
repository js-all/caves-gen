const canvas = <HTMLCanvasElement>document.getElementsByTagName('canvas')[0];
const ctx = <CanvasRenderingContext2D>canvas.getContext('2d');
const cw = 2048;
const ch = 2048;
canvas.width = cw;
canvas.height = ch;

const mapSize = new Vector(64, 64);
const neighbourTreshold = 4
const neighbourDistance = new Vector(1, 1);
const fillPercent = 35;
const fillEdges = true;
const tmpTris: Tris<Vector>[] = [];
const Verticies: Vector[] = [];
const tris: Tris<number>[] = [];
const OutlineEdges: [number, number][] = [];
// list of indexes that, VerticiesIndexList[vertex] will give out the index of every tris that use that vertex
const VerticiesIndexList: number[][] = [];
/**
 * false: if neighbourCount == neighbourTreshold => wall
 * true: if neighbourCount == neighbourTreshold => nothing
 */
const equalCase = false;

var MapDebug = false;
var MapDebugShowCellType = false;
var MapRenderingMethod: "circles" | "squares" = "circles";
var Rendering: "Map" | "Marching" = "Marching";
var ShowMarchingWireFrame = false;
var MarchingWireFrameSize = 3;
var showMarchingGrid = false;
const tileSize = new Vector(cw / mapSize.x, ch / mapSize.y);


const triangulationMap: number[][] = [
    /*00:0000*/[],
    /*01:0001*/[1, 6, 5],
    /*02:0010*/[6, 2, 7],
    /*03:0011*/[1, 2, 5, 2, 7, 5],
    /*04:0100*/[7, 3, 8],
    /*05:0101*/[1, 6, 7, 1, 7, 3, 1, 3, 5, 5, 3, 8],
    /*06:0110*/[6, 2, 8, 2, 3, 8],
    /*07:0111*/[1, 2, 5, 5, 2, 3, 5, 3, 8],
    /*08:1000*/[5, 8, 4],
    /*09:1001*/[1, 6, 8, 1, 8, 4],
    /*10:1010*/[5, 6, 2, 5, 2, 4, 4, 2, 7, 4, 7, 8],
    /*11:1011*/[1, 8, 4, 1, 2, 8, 2, 7, 8],
    /*12:1100*/[5, 7, 3, 5, 3, 4],
    /*13:1101*/[1, 6, 7, 1, 7, 4, 4, 7, 3],
    /*14:1110*/[5, 6, 2, 5, 2, 3, 5, 3, 4],
    /*15:1111*/[1, 2, 3, 1, 3, 4]
]

type Tris<T> = [T, T, T];

var map: boolean[][] = [];
var oldMaps: boolean[][][] = [];

function createMap(mapArray: boolean[][]) {
    if (mapArray.length > 0) {
        mapArray.splice(0, mapArray.length)
    }
    for (let x = 0; x < mapSize.x; x++) {
        mapArray.push([]);
        for (let y = 0; y < mapSize.x; y++) {
            mapArray[x].push(true);
        }
    }
}

function initMap() {
    for (let x = 0; x < mapSize.x; x++) {
        for (let y = 0; y < mapSize.x; y++) {
            if ((x === 1 || x === mapSize.x - 1 || y === 1 || y === mapSize.y - 1) && fillEdges) {
                map[x][y] = true;
            } else {
                map[x][y] = Math.random() < fillPercent / 100;
            }
        }
    }
}

function draw() {
    ctx.clearRect(-tileSize.x, -tileSize.y, cw + tileSize.x, ch + tileSize.y);
    ctx.fillStyle = "white";
    ctx.fillRect(-tileSize.x, -tileSize.y, cw + tileSize.x, ch + tileSize.y);
    if (Rendering == "Map") {
        loopMap((pos: Vector, mapValue: boolean) => {
            if (MapDebug) {
                const neighbourCount = getNeighbouringCellsWallCount(pos.x, pos.y, false);
                const color = (neighbourCount / -8 + 1) * 255;
                ctx.fillStyle = `rgb(${color}, ${color}, ${color})`
                ctx.fillRect(pos.x * tileSize.x, pos.y * tileSize.y, tileSize.x, tileSize.y);
                if (MapDebugShowCellType) {
                    ctx.strokeStyle = mapValue ? "black" : "white";
                    ctx.lineWidth = 5
                    ctx.strokeRect(pos.x * tileSize.x + ctx.lineWidth / 2, pos.y * tileSize.y + ctx.lineWidth / 2, tileSize.x - ctx.lineWidth, tileSize.y - ctx.lineWidth);
                }
                ctx.fillStyle = color > 128 ? "black" : "white";
                const fontSize = 30;
                ctx.font = fontSize + "px Arial"
                ctx.fillText(neighbourCount.toString(), pos.x * tileSize.x + tileSize.x / 2 - ctx.measureText(neighbourCount.toString()).width / 2, pos.y * tileSize.y + tileSize.y - fontSize / 4);
            } else {
                ctx.fillStyle = mapValue ? "black" : "white";
                if (MapRenderingMethod === "circles") {
                    ctx.beginPath()
                    ctx.arc(pos.x * tileSize.x + tileSize.x / 2, pos.y * tileSize.y + tileSize.y / 2, tileSize.x / 4, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.closePath();
                } else {
                    ctx.fillRect(pos.x * tileSize.x, pos.y * tileSize.y, tileSize.x, tileSize.y);
                }
            }
        });
    } else {
        ctx.fillStyle = "black";
        ctx.strokeStyle = ShowMarchingWireFrame ? "rgb(29, 29, 29)" : "black";
        ctx.lineWidth = ShowMarchingWireFrame ? MarchingWireFrameSize : 1;
        for (let i of tris) {
            ctx.beginPath();
            ctx.moveTo(...Verticies[i[0]].multiply(tileSize).toArray());
            ctx.lineTo(...Verticies[i[1]].multiply(tileSize).toArray());
            ctx.lineTo(...Verticies[i[2]].multiply(tileSize).toArray());
            ctx.lineTo(...Verticies[i[0]].multiply(tileSize).toArray());
            ctx.fill();
            ctx.stroke();
            ctx.closePath();
        }
        if (OutlineEdges[0] !== undefined) {
            ctx.strokeStyle = "grey";
            ctx.lineWidth = 10;
            for (let i of OutlineEdges) {
                ctx.beginPath()
                ctx.moveTo(...Verticies[i[0]].multiply(tileSize).toArray())
                ctx.lineTo(...Verticies[i[1]].multiply(tileSize).toArray())
                ctx.stroke();
                ctx.closePath();
            }
        }
    }
    requestAnimationFrame(draw);
}

function loopMap(func: (pos: Vector, mapValue: boolean) => boolean | void) {
    for (let x = 0; x < mapSize.x; x++) {
        for (let y = 0; y < mapSize.y; y++) {
            const res = func(new Vector(x, y), map[x][y]);
            if (res != undefined) map[x][y] = res;
        }
    }
}

function getNeighbouringCellsWallCount(x: number, y: number, temp: boolean = false) {
    let neighbourCount = 0;
    for (let nx = x - neighbourDistance.x; nx <= x + neighbourDistance.x; nx++) {
        for (let ny = y - neighbourDistance.y; ny <= y + neighbourDistance.y; ny++) {
            if (nx >= 0 && nx < mapSize.x && ny >= 0 && ny < mapSize.y) {
                if (nx !== x || ny !== y) {
                    if (map[nx][ny]) neighbourCount++;
                }
            } else {
                neighbourCount++;
            }
        };
    };
    return neighbourCount;
}

function smoothMap(iteration: number) {
    for (let i of new Array(iteration)) {
        const newMap: boolean[][] = [];
        createMap(newMap);
        loopMap((pos: Vector, cellValue: boolean) => {
            const neighbouringCellsWallCount = getNeighbouringCellsWallCount(pos.x, pos.y);
            if (equalCase) {
                if (neighbouringCellsWallCount > neighbourTreshold) newMap[pos.x][pos.y] = true;
                else newMap[pos.x][pos.y] = false;
            } else {
                if (neighbouringCellsWallCount < neighbourTreshold) newMap[pos.x][pos.y] = false;
                else newMap[pos.x][pos.y] = true;
            }
        });
        oldMaps.push(map);
        map = newMap;
    }
}

function march() {
    tmpTris.splice(0, tmpTris.length);
    for (let x = -1; x < mapSize.x; x++) {
        for (let y = -1; y < mapSize.y; y++) {
            const MapPlaceHolder: boolean[] = new Array<boolean>(mapSize.y).fill(false);
            const c: [number, number, number, number] = [(map[x + 1] || MapPlaceHolder)[y] ? 1 : 0, (map[x + 1] || MapPlaceHolder)[y + 1] ? 1 : 0, (map[x] || MapPlaceHolder)[y + 1] ? 1 : 0, (map[x] || MapPlaceHolder)[y] ? 1 : 0];
            const id = (((c[3] << 1) + c[2] << 1) + c[1] << 1) + c[0];
            const triangulation = triangulationMap[id];
            for (let i = 0; i < triangulation.length; i += 3) {
                const intToOffset = (vert: number): Vector => {
                    switch (vert) {
                        case 1:
                            return new Vector(1, 0);
                        case 2:
                            return new Vector(1, 1);
                        case 3:
                            return new Vector(0, 1);
                        case 4:
                            return new Vector(0, 0);
                        case 5:
                            return new Vector(0.5, 0);
                        case 6:
                            return new Vector(1, 0.5);
                        case 7:
                            return new Vector(0.5, 1);
                        case 8:
                            return new Vector(0, 0.5);
                    };
                    return Vector.null;
                }
                // to solve offset problem
                x += .5;
                y += .5;
                const vert1 = intToOffset(triangulation[i]).add(new Vector(x, y));
                const vert2 = intToOffset(triangulation[i + 1]).add(new Vector(x, y));
                const vert3 = intToOffset(triangulation[i + 2]).add(new Vector(x, y));
                x -= .5;
                y -= .5;
                tmpTris.push([vert1, vert2, vert3]);
            }
        }
    }
    cleanMarchedMesh();
}

function cleanMarchedMesh() {
    Verticies.splice(0, Verticies.length);
    tris.splice(0, tris.length);
    VerticiesIndexList.splice(0, VerticiesIndexList.length);
    const uniqueVertexs: Vector[] = [];
    const trisList: Tris<number>[] = [];
    const VIL: typeof VerticiesIndexList = [];
    for (let exec = 0; exec <= 1; exec++) {
        for (let i of tmpTris) {
            if (!exec) {
                for (let j of i) {
                    let foundDuplicate = false;
                    for (let k of uniqueVertexs) {
                        if (k.equals(j)) {
                            foundDuplicate = true;
                            break;
                        }
                    }
                    if (!foundDuplicate) {
                        uniqueVertexs.push(j);
                    }
                }
            } else {
                let idTris = [];
                for (let j of i) {
                    for (let k = 0; k < uniqueVertexs.length; k++) {
                        if (uniqueVertexs[k].equals(j)) {
                            idTris.push(k);
                            break;
                        }
                    }
                }
                trisList.push(<Tris<number>>idTris);
            }
        }
    }
    for (let i = 0; i < uniqueVertexs.length; i++) {
        const includedInTris: number[] = [];
        for (let j = 0; j < trisList.length; j++) {
            for (let k of trisList[j]) {
                if (i === k) includedInTris.push(j)
            }
        }
        VIL.push(includedInTris);
    }
    tmpTris.splice(0, tmpTris.length);
    Verticies.push(...uniqueVertexs);
    tris.push(...trisList)
    VerticiesIndexList.push(...VIL)
    getOutlinesFromCleanMesh();
}

function getOutlinesFromCleanMesh() {
    OutlineEdges.splice(0, OutlineEdges.length);
    for (let v = 0; v < Verticies.length; v++) {
        const linkedTris = VerticiesIndexList[v];
        const linkedEdges: [number, number][] = [];
        for (let i of linkedTris) {
            const tri = tris[i];
            const edges: [number, number][] = [[tri[0], tri[1]], [tri[1], tri[2]], [tri[2], tri[0]]];
            for (let j = 0; j < 3; j++) {
                if (edges[j][0] === v || edges[j][1] === v) {
                    linkedEdges.push(edges[j]);
                }
            }
        }
        for (let i of linkedEdges) {
            const lt1 = VerticiesIndexList[i[0]];
            const lt2 = VerticiesIndexList[i[1]];
            let commonTris: number = 0;
            for (let j of lt1) {
                for (let k of lt2) {
                    if (j === k) {
                        commonTris++;
                    }
                }
            }
            if (commonTris === 1) {
                OutlineEdges.push(i);
            }
        }
    }
}

function switchRenderingMethod() {
    Rendering = Rendering === "Map" ? "Marching" : "Map";
    if (Rendering === "Marching") march();
}

function ChangeCurrentMapCW() {
    oldMaps.push([...map]);
    map = oldMaps.splice(0, 1)[0];
    if (Rendering === "Marching") march();
}

function ChangeCurrentMapCCW() {
    oldMaps = [map].concat(oldMaps);
    map = <boolean[][]>oldMaps.pop();
    if (Rendering === "Marching") march();
}

createMap(map);
initMap();
smoothMap(12);
march();
draw();

const _$$c: HTMLCanvasElement = canvas;
const _$$cw = _$$c.width;
const _$$ch = _$$c.height;
function _$$adaptSize() {
    let rhl = _$$cw / _$$ch;
    let rlh = _$$ch / _$$cw;
    if (window.innerWidth > window.innerHeight * rhl) {
        _$$c.style.width = 'inherit';
        _$$c.style.height = '100%';
    }
    if (window.innerHeight > window.innerWidth * rlh) {
        _$$c.style.height = 'inherit';
        _$$c.style.width = '100%';
    }
}
_$$adaptSize();

window.addEventListener('resize', _$$adaptSize);

