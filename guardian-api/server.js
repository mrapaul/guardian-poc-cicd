const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const WebSocket = require('ws');
const http = require('http');
const { v4: uuidv4 } = require('uuid');
const winston = require('winston');
const morgan = require('morgan');
const IPCIDR = require('ip-cidr');
const { Netmask } = require('netmask');
const fs = require('fs');
const path = require('path');

// Configure Winston logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: '../logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: '../logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: { write: msg => logger.info(msg.trim()) }}));

// In-memory data stores
let scanResults = new Map();
let networkTopology = new Map();
let vulnerabilities = new Map();
let policies = new Map();
let remediations = new Map();
let systemLogs = [];
let activeScans = new Map();
let metrics = {
  totalScans: 0,
  hostsDiscovered: 0,
  vulnerabilitiesFound: 0,
  policiesEnforced: 0,
  remediationsApplied: 0,
  lastUpdateTime: new Date()
};

// WebSocket connections
const wsClients = new Set();

wss.on('connection', (ws) => {
  wsClients.add(ws);
  logger.info('New WebSocket client connected');
  
  // Send initial data
  ws.send(JSON.stringify({
    type: 'initial',
    data: {
      topology: Array.from(networkTopology.values()),
      metrics: metrics,
      logs: systemLogs.slice(-50)
    }
  }));
  
  ws.on('close', () => {
    wsClients.delete(ws);
    logger.info('WebSocket client disconnected');
  });
  
  ws.on('error', (error) => {
    logger.error('WebSocket error:', error);
  });
});

// Broadcast to all WebSocket clients
function broadcast(data) {
  const message = JSON.stringify(data);
  wsClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Add system log
function addLog(level, message, details = {}) {
  const log = {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    level,
    message,
    details
  };
  
  systemLogs.push(log);
  if (systemLogs.length > 1000) {
    systemLogs = systemLogs.slice(-1000);
  }
  
  logger[level](message, details);
  
  broadcast({
    type: 'log',
    data: log
  });
  
  return log;
}

// Network discovery function
async function discoverNetwork(subnet) {
  const scanId = uuidv4();
  const startTime = Date.now();
  
  addLog('info', `Starting network discovery for ${subnet}`, { scanId, subnet });
  
  try {
    const cidr = new IPCIDR(subnet);
    const hosts = [];
    const topology = {
      nodes: [],
      links: []
    };
    
    // Parse subnet and generate IPs
    const ipList = cidr.toArray({ from: 1, limit: 254 });
    
    addLog('info', `Scanning ${ipList.length} potential hosts`, { scanId, count: ipList.length });
    
    // Simulate progressive discovery
    for (let i = 0; i < Math.min(ipList.length, 50); i++) {
      const ip = ipList[i];
      const isActive = Math.random() > 0.6;
      
      if (isActive) {
        const host = {
          id: `host-${ip.replace(/\./g, '-')}`,
          ip: ip,
          hostname: `host-${i}.local`,
          mac: generateMAC(),
          status: 'active',
          type: getRandomDeviceType(),
          os: getRandomOS(),
          services: generateServices(),
          vulnerabilities: generateVulnerabilities(),
          risk: calculateRiskScore(),
          lastSeen: new Date().toISOString(),
          responseTime: Math.floor(Math.random() * 100) + 1
        };
        
        hosts.push(host);
        networkTopology.set(ip, host);
        
        // Add to topology
        topology.nodes.push({
          id: host.id,
          ip: host.ip,
          label: host.hostname,
          type: host.type,
          risk: host.risk,
          status: host.status
        });
        
        // Broadcast real-time update
        broadcast({
          type: 'host_discovered',
          data: host
        });
        
        metrics.hostsDiscovered++;
        
        // Add some delay to simulate real scanning
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    // Create network links
    if (topology.nodes.length > 1) {
      // Create a star topology with gateway
      const gateway = topology.nodes[0];
      for (let i = 1; i < topology.nodes.length; i++) {
        topology.links.push({
          source: gateway.id,
          target: topology.nodes[i].id,
          type: 'network'
        });
      }
      
      // Add some mesh connections
      for (let i = 1; i < Math.min(topology.nodes.length, 10); i++) {
        if (Math.random() > 0.7) {
          const randomTarget = Math.floor(Math.random() * topology.nodes.length);
          if (randomTarget !== i && randomTarget !== 0) {
            topology.links.push({
              source: topology.nodes[i].id,
              target: topology.nodes[randomTarget].id,
              type: 'communication'
            });
          }
        }
      }
    }
    
    const scanResult = {
      scanId,
      subnet,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date().toISOString(),
      duration: Date.now() - startTime,
      hostsFound: hosts.length,
      hosts,
      topology,
      status: 'completed'
    };
    
    scanResults.set(scanId, scanResult);
    metrics.totalScans++;
    metrics.lastUpdateTime = new Date();
    
    addLog('info', `Network discovery completed: ${hosts.length} hosts found`, {
      scanId,
      hostsFound: hosts.length,
      duration: scanResult.duration
    });
    
    // Broadcast completion
    broadcast({
      type: 'scan_complete',
      data: scanResult
    });
    
    return scanResult;
    
  } catch (error) {
    addLog('error', `Network discovery failed: ${error.message}`, { scanId, error: error.stack });
    throw error;
  }
}

// Helper functions
function generateMAC() {
  const hex = '0123456789ABCDEF';
  let mac = '';
  for (let i = 0; i < 6; i++) {
    if (i > 0) mac += ':';
    mac += hex[Math.floor(Math.random() * 16)];
    mac += hex[Math.floor(Math.random() * 16)];
  }
  return mac;
}

function getRandomDeviceType() {
  const types = ['server', 'workstation', 'router', 'switch', 'firewall', 'printer', 'iot', 'mobile'];
  return types[Math.floor(Math.random() * types.length)];
}

function getRandomOS() {
  const oses = ['Windows Server 2019', 'Ubuntu 22.04', 'CentOS 8', 'Windows 11', 'macOS Ventura', 'Debian 11', 'RouterOS', 'iOS 16'];
  return oses[Math.floor(Math.random() * oses.length)];
}

function generateServices() {
  const allServices = [
    { port: 22, name: 'SSH', version: 'OpenSSH 8.0' },
    { port: 80, name: 'HTTP', version: 'Apache 2.4' },
    { port: 443, name: 'HTTPS', version: 'nginx 1.20' },
    { port: 3306, name: 'MySQL', version: '8.0' },
    { port: 5432, name: 'PostgreSQL', version: '14.0' },
    { port: 3389, name: 'RDP', version: 'Windows RDP' },
    { port: 445, name: 'SMB', version: 'SMBv3' },
    { port: 8080, name: 'HTTP-Alt', version: 'Tomcat 9.0' }
  ];
  
  const count = Math.floor(Math.random() * 4) + 1;
  const services = [];
  for (let i = 0; i < count; i++) {
    const service = allServices[Math.floor(Math.random() * allServices.length)];
    if (!services.find(s => s.port === service.port)) {
      services.push({...service, state: 'open'});
    }
  }
  return services;
}

function generateVulnerabilities() {
  const vulnTemplates = [
    { 
      id: 'CVE-2021-44228', 
      name: 'Log4Shell', 
      severity: 'critical', 
      cvss: 10.0,
      description: 'Apache Log4j2 Remote Code Execution',
      remediation: 'Update Log4j to version 2.17.0 or later'
    },
    { 
      id: 'CVE-2021-34527', 
      name: 'PrintNightmare', 
      severity: 'critical', 
      cvss: 8.8,
      description: 'Windows Print Spooler Remote Code Execution',
      remediation: 'Apply Windows security update KB5004945'
    },
    { 
      id: 'CVE-2020-1472', 
      name: 'Zerologon', 
      severity: 'critical', 
      cvss: 10.0,
      description: 'Netlogon Elevation of Privilege Vulnerability',
      remediation: 'Apply Windows security update and enforce secure RPC'
    },
    { 
      id: 'CVE-2022-30190', 
      name: 'Follina', 
      severity: 'high', 
      cvss: 7.8,
      description: 'Microsoft Windows Support Diagnostic Tool RCE',
      remediation: 'Disable MSDT URL protocol'
    },
    { 
      id: 'VULN-001', 
      name: 'Weak SSH Configuration', 
      severity: 'medium', 
      cvss: 5.3,
      description: 'SSH allows password authentication',
      remediation: 'Disable password authentication, use key-based auth'
    }
  ];
  
  const vulns = [];
  const count = Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i++) {
    const vuln = vulnTemplates[Math.floor(Math.random() * vulnTemplates.length)];
    if (!vulns.find(v => v.id === vuln.id)) {
      vulns.push({
        ...vuln,
        discovered: new Date().toISOString(),
        status: 'open'
      });
      metrics.vulnerabilitiesFound++;
    }
  }
  return vulns;
}

function calculateRiskScore() {
  const scores = ['low', 'medium', 'high', 'critical'];
  return scores[Math.floor(Math.random() * scores.length)];
}

// API Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'guardian-api',
    uptime: process.uptime(),
    metrics: metrics
  });
});

// Logs endpoint
app.get('/api/logs', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const level = req.query.level;
  
  let logs = systemLogs.slice(-limit);
  if (level) {
    logs = logs.filter(log => log.level === level);
  }
  
  res.json(logs);
});

// Network scanning
app.post('/api/scanner/discover', async (req, res) => {
  const { subnet } = req.body;
  
  if (!subnet) {
    return res.status(400).json({ error: 'Subnet is required' });
  }
  
  try {
    addLog('info', `API: Network discovery initiated for ${subnet}`);
    
    // Start async scan
    const scanPromise = discoverNetwork(subnet);
    
    // Return immediately with scan ID
    res.json({ 
      message: 'Network discovery initiated',
      subnet,
      scanId: 'pending'
    });
    
    // Continue scanning in background
    scanPromise.catch(error => {
      addLog('error', `Background scan failed: ${error.message}`);
    });
    
  } catch (error) {
    addLog('error', `API error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Get scan results
app.get('/api/scanner/results/:scanId', (req, res) => {
  const { scanId } = req.params;
  const result = scanResults.get(scanId);
  
  if (!result) {
    return res.status(404).json({ error: 'Scan not found' });
  }
  
  res.json(result);
});

// Get all scan results
app.get('/api/scanner/results', (req, res) => {
  const results = Array.from(scanResults.values());
  res.json(results);
});

// Get network topology
app.get('/api/topology', (req, res) => {
  const topology = {
    nodes: [],
    links: []
  };
  
  const hosts = Array.from(networkTopology.values());
  
  hosts.forEach(host => {
    topology.nodes.push({
      id: host.id,
      ip: host.ip,
      label: host.hostname,
      type: host.type,
      risk: host.risk,
      status: host.status,
      vulnerabilities: host.vulnerabilities.length
    });
  });
  
  // Generate links
  if (topology.nodes.length > 1) {
    const gateway = topology.nodes[0];
    for (let i = 1; i < topology.nodes.length; i++) {
      topology.links.push({
        source: gateway.id,
        target: topology.nodes[i].id,
        type: 'network'
      });
    }
  }
  
  res.json(topology);
});

// Get host details
app.get('/api/hosts/:ip', (req, res) => {
  const { ip } = req.params;
  const host = networkTopology.get(ip);
  
  if (!host) {
    return res.status(404).json({ error: 'Host not found' });
  }
  
  res.json(host);
});

// Vulnerability management
app.get('/api/vulnerabilities', (req, res) => {
  const allVulns = [];
  
  networkTopology.forEach(host => {
    host.vulnerabilities.forEach(vuln => {
      allVulns.push({
        ...vuln,
        host: host.ip,
        hostname: host.hostname
      });
    });
  });
  
  res.json(allVulns);
});

// Apply remediation
app.post('/api/remediate', (req, res) => {
  const { hostIp, vulnerabilityId, action } = req.body;
  
  const host = networkTopology.get(hostIp);
  if (!host) {
    return res.status(404).json({ error: 'Host not found' });
  }
  
  const vuln = host.vulnerabilities.find(v => v.id === vulnerabilityId);
  if (!vuln) {
    return res.status(404).json({ error: 'Vulnerability not found' });
  }
  
  vuln.status = 'remediated';
  vuln.remediatedAt = new Date().toISOString();
  vuln.remediationAction = action;
  
  metrics.remediationsApplied++;
  
  addLog('info', `Remediation applied: ${vulnerabilityId} on ${hostIp}`, {
    host: hostIp,
    vulnerability: vulnerabilityId,
    action
  });
  
  broadcast({
    type: 'remediation_applied',
    data: {
      host: hostIp,
      vulnerability: vulnerabilityId,
      action
    }
  });
  
  res.json({ 
    message: 'Remediation applied successfully',
    host: hostIp,
    vulnerability: vulnerabilityId
  });
});

// Policy management
app.get('/api/policies', (req, res) => {
  res.json(Array.from(policies.values()));
});

app.post('/api/policies', (req, res) => {
  const policy = {
    id: uuidv4(),
    ...req.body,
    created: new Date().toISOString(),
    status: 'active'
  };
  
  policies.set(policy.id, policy);
  metrics.policiesEnforced++;
  
  addLog('info', `Policy created: ${policy.name}`, { policyId: policy.id });
  
  broadcast({
    type: 'policy_created',
    data: policy
  });
  
  res.json(policy);
});

// Metrics endpoint
app.get('/api/metrics', (req, res) => {
  res.json(metrics);
});

// Framework compliance
app.get('/api/frameworks', (req, res) => {
  const frameworksPath = path.join(__dirname, '..', 'frameworks', 'nist_csf.json');
  
  if (fs.existsSync(frameworksPath)) {
    const framework = JSON.parse(fs.readFileSync(frameworksPath, 'utf8'));
    res.json(framework);
  } else {
    res.json({
      name: "NIST Cybersecurity Framework",
      version: "2.0",
      categories: [
        {
          id: "IDENTIFY",
          name: "Identify",
          subcategories: ["Asset Management", "Risk Assessment"]
        },
        {
          id: "PROTECT",
          name: "Protect",
          subcategories: ["Access Control", "Data Security"]
        },
        {
          id: "DETECT",
          name: "Detect",
          subcategories: ["Anomalies", "Security Monitoring"]
        },
        {
          id: "RESPOND",
          name: "Respond",
          subcategories: ["Incident Response", "Mitigation"]
        },
        {
          id: "RECOVER",
          name: "Recover",
          subcategories: ["Recovery Planning", "Improvements"]
        }
      ]
    });
  }
});

// Start server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  logger.info(`Guardian API server running on port ${PORT}`);
  addLog('info', 'Guardian Security Platform API started', { port: PORT });
});