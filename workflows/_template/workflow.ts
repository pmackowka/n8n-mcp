import { workflow, node, trigger } from '@n8n/workflow-sdk';

// --- Define trigger ---
const scheduleTrigger = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Trigger',
    rule: {
      interval: [{
        field: 'weeks',
        triggerAtDay: [1],
        triggerAtHour: 9,
        triggerAtMinute: 0
      }]
    },
    position: [240, 300]
  },
  output: [{}]
});

// --- Define nodes ---
const httpRequest = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'HTTP Request',
    method: 'GET',
    url: 'https://api.example.com/data',
    authentication: 'none',
    options: {},
    position: [520, 300]
  },
  output: [{}]
});

const processData = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Process Data',
    language: 'javascript',
    executeOnce: true,
    code: `
return $input.all().map(item => ({
  json: {
    result: item.json
  }
}));
`
  },
  output: [{}]
});

// --- Compose workflow ---
export default workflow('workflow-id', 'Workflow Name')
  .add(scheduleTrigger)
  .to(httpRequest)
  .to(processData);
