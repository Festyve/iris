// Map each visit to an ordered slice of the design. Small and large fleets both
// build every layer once, even when a slow frame skips an animation phase.
function screenJobs(count,screen){
  const jobs=Shared.makeJobs(count,screen.layers,screen.width,screen.height),total=count*3;
  for(const job of jobs){
    for(let stage=0;stage<3;stage++){
      const slot=stage*count+job.id;
      const first=Math.floor(slot*screen.layers.length/total),last=Math.floor((slot+1)*screen.layers.length/total);
      const layer=screen.layers[first];
      job.targets[stage]={first,last};
      job.points[stage+1]={x:layer.x+layer.w*(.18+(job.id%5)*.12),y:layer.y+layer.h*.45};
    }
  }
  return jobs;
}
