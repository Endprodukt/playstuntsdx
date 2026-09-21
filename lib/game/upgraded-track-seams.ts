import type {Shape} from './types.ts';

// The source raster models deliberately overlap neighbouring tiles by one to
// seven world units. That hid integer-raster cracks, but two intersecting
// zero-thickness planes expose a wedge or hairline when the modern camera
// looks along a tile join. Normalize only known continuous road/terrain and
// elevated bridge chains so adjoining modules terminate at the shared +/-512
// tile boundary; unrelated scenery keeps its authored overlap untouched.
const NORMALIZED_AXES:Readonly<Record<string,readonly number[]>>={
 'GAME1.road':[2],
 'GAME1.zroa':[2],
 'GAME2.rdup':[0,2],
 'GAME2.zrdu':[2],
 'GAME2.goup':[0,2],
 'GAME2.high':[0,2],
 // Elevated/bridge pieces use the same raster-era 513..519 overlap at their
 // tile borders. In the original integer renderer that overlap hid cracks;
 // in WebGL it produces the faint cross-road and vertical side-wall seams
 // visible where two bridge modules meet. Snap only coordinates already within
 // seven source units of a tile edge, leaving the actual bridge profile intact.
 'GAME2.brid':[0,2],
 'GAME2.zbri':[0,2],
 'GAME2.elrd':[0,2],
 'GAME2.zelr':[0,2],
 'GAME2.elsp':[0,2],
 'GAME2.zesp':[0,2],
};
const cached=new WeakMap<Shape,Map<string,Shape>>();

export function upgradedTrackSeamShape(shape:Shape,shapeName:string):Shape{
 const axes=NORMALIZED_AXES[shapeName];if(!axes)return shape;
 let variants=cached.get(shape);if(!variants){variants=new Map();cached.set(shape,variants);}
 const previous=variants.get(shapeName);if(previous)return previous;
 const vertices=shape.vertices.map(vertex=>vertex.map((coordinate,axis)=>axes.includes(axis)&&Math.abs(coordinate)>=513&&Math.abs(coordinate)<=519?Math.sign(coordinate)*512:coordinate) as [number,number,number]);
 const normalized={...shape,vertices};variants.set(shapeName,normalized);return normalized;
}
