/**
 * Optional Graphics 3C terrain switch. Rendering-only and fail-closed.
 * Main Pre-Alpha keeps the exact original grid until an explicit opt-in.
 * Never alter player position, Combat/World physics or network state.
 */
export function chooseArenaFloorLayer({enabled=false,createOriginal,createOptional}={}){
  if(typeof createOriginal!=="function"||typeof createOptional!=="function")
    throw new TypeError("Both original and optional arena factories are required");
  if(enabled===true){
    try{
      const layer=createOptional();
      if(layer&&Number.isInteger(layer.width)&&Number.isInteger(layer.height)&&
         layer.width>0&&layer.height>0)return layer;
    }catch{
      // A malformed optional Canvas must never prevent Combat startup.
    }
  }
  return createOriginal();
}
