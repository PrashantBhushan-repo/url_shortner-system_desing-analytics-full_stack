export async function loadLinkReport(api, id, range, signal) {
  const options = { signal };
  const info = await api.get(`/urls/id/${id}`,options);
  const paths = [`/analytics/${id}/overview?range=${range}`, `/analytics/${id}/timeseries?range=${range}`, `/analytics/${id}/referrers?range=${range}`, `/analytics/${id}/geo?range=${range}`, `/analytics/${id}/devices?range=${range}`, '/subscription'];
  const results = await Promise.allSettled(paths.map(path => api.get(path,options)));
  if (signal?.aborted) throw Object.assign(new Error('Cancelled'),{code:'ERR_CANCELED'});
  if (results[0].status === 'rejected') throw results[0].reason;
  const issues = [], locked = {};
  const read = (index,fallback,label) => {
    const result = results[index];
    if (result.status === 'fulfilled') return result.value.data?.data ?? fallback;
    const error = result.reason;
    if (error.response?.status === 403 && error.response?.data?.code === 'PLAN_LIMIT') locked[label]=true;
    else issues.push(`${label} could not be loaded.`);
    return fallback;
  };
  return { id:String(id), range, info:info.data?.data, overview:results[0].value.data?.data || {}, series:read(1,[],'Click activity'), referrers:read(2,{referrers:[],sources:[]},'Traffic sources'), geo:read(3,{countries:[],cities:[]},'Geography'), devices:read(4,{devices:[],browsers:[],platforms:[]},'Devices'), subscription:read(5,null,'Plan details'), issues, locked };
}
