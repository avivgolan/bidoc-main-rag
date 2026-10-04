// Scheduler entry point. Only reads sources and inserts into the three new dashboard tables.
import {loadEnv,initSettings,getConfig} from '../src/config.js';
import {createDashboardService} from '../src/dashboard/service.js';
const projectId=process.argv[2];
if(!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(projectId || ''))throw new Error('Usage: node scripts/capture-dashboard-snapshot.mjs <project-uuid>');
loadEnv();await initSettings();
const service=createDashboardService(),config=getConfig();
const view=await service.overview(config,null,{projectId});
const result=await service.saveSnapshot(config,null,view.queryToken,{runKind:'daily'});
console.log(JSON.stringify({projectId,asOf:result.overview.asOf,...result.saved}));
