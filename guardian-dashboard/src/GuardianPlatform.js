import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box, Paper, Typography, Button, TextField, Grid, Card, CardContent,
  AppBar, Toolbar, Tab, Tabs, IconButton, Chip, LinearProgress,
  List, ListItem, ListItemText, ListItemIcon, Divider, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions, Switch,
  FormControlLabel, Select, MenuItem, FormControl, InputLabel,
  Badge, Tooltip, Drawer, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, CircularProgress, Snackbar
} from '@mui/material';
import {
  NetworkCheck, Security, BugReport, Policy, Dashboard,
  Warning, Error as ErrorIcon, CheckCircle, Info,
  PlayArrow, Stop, Refresh, Settings, Terminal,
  Assessment, Timeline, Storage, Router, Computer,
  Visibility, VisibilityOff, Download, Upload
} from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer
} from 'recharts';
import * as d3 from 'd3';
import axios from 'axios';
import moment from 'moment';
import ReactJson from 'react-json-view';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';
const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:8080';

function GuardianPlatform() {
  // State Management
  const [activeTab, setActiveTab] = useState(0);
  const [subnet, setSubnet] = useState('192.168.1.0/24');
  const [scanning, setScanning] = useState(false);
  const [networkData, setNetworkData] = useState({ nodes: [], links: [] });
  const [selectedNode, setSelectedNode] = useState(null);
  const [vulnerabilities, setVulnerabilities] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [logs, setLogs] = useState([]);
  const [metrics, setMetrics] = useState({
    totalScans: 0,
    hostsDiscovered: 0,
    vulnerabilitiesFound: 0,
    policiesEnforced: 0,
    remediationsApplied: 0
  });
  const [showLogs, setShowLogs] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'info' });
  
  const svgRef = useRef(null);
  const wsRef = useRef(null);
  const d3Simulation = useRef(null);

  // WebSocket Connection
  useEffect(() => {
    const connectWebSocket = () => {
      wsRef.current = new WebSocket(WS_URL);
      
      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
        showNotification('Connected to real-time updates', 'success');
      };
      
      wsRef.current.onmessage = (event) => {
        const message = JSON.parse(event.data);
        handleWebSocketMessage(message);
      };
      
      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        showNotification('Connection error', 'error');
      };
      
      wsRef.current.onclose = () => {
        console.log('WebSocket disconnected');
        showNotification('Disconnected from real-time updates', 'warning');
        // Reconnect after 3 seconds
        setTimeout(connectWebSocket, 3000);
      };
    };
    
    connectWebSocket();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((message) => {
    switch (message.type) {
      case 'initial':
        setNetworkData(message.data.topology || { nodes: [], links: [] });
        setMetrics(message.data.metrics || {});
        setLogs(message.data.logs || []);
        break;
        
      case 'host_discovered':
        const newHost = message.data;
        setNetworkData(prev => ({
          ...prev,
          nodes: [...prev.nodes, {
            id: newHost.id,
            ip: newHost.ip,
            label: newHost.hostname,
            type: newHost.type,
            risk: newHost.risk,
            status: newHost.status
          }]
        }));
        showNotification(`New host discovered: ${newHost.ip}`, 'info');
        break;
        
      case 'scan_complete':
        setScanning(false);
        const result = message.data;
        setNetworkData(result.topology);
        showNotification(`Scan completed: ${result.hostsFound} hosts found`, 'success');
        break;
        
      case 'log':
        setLogs(prev => [message.data, ...prev].slice(0, 100));
        break;
        
      case 'remediation_applied':
        showNotification(`Remediation applied to ${message.data.host}`, 'success');
        break;
        
      default:
        console.log('Unknown message type:', message.type);
    }
  }, []);

  // Show notification
  const showNotification = (message, severity = 'info') => {
    setNotification({ open: true, message, severity });
  };

  // Initialize D3 Network Graph
  useEffect(() => {
    if (!svgRef.current || activeTab !== 0) return;
    
    const svg = d3.select(svgRef.current);
    const width = svgRef.current.clientWidth;
    const height = 500;
    
    svg.selectAll('*').remove();
    
    const g = svg.append('g');
    
    // Add zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.1, 10])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });
    
    svg.call(zoom);
    
    // Create force simulation
    d3Simulation.current = d3.forceSimulation()
      .force('link', d3.forceLink().id(d => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(30));
    
    updateNetworkGraph();
  }, [activeTab]);

  // Update D3 Network Graph
  const updateNetworkGraph = useCallback(() => {
    if (!svgRef.current || !d3Simulation.current) return;
    
    const svg = d3.select(svgRef.current);
    const g = svg.select('g');
    
    // Update links
    const link = g.selectAll('.link')
      .data(networkData.links, d => `${d.source}-${d.target}`);
    
    link.exit().remove();
    
    const linkEnter = link.enter()
      .append('line')
      .attr('class', 'link')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', 2);
    
    // Update nodes
    const node = g.selectAll('.node')
      .data(networkData.nodes, d => d.id);
    
    node.exit().remove();
    
    const nodeEnter = node.enter()
      .append('g')
      .attr('class', 'node')
      .call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));
    
    // Add circles for nodes
    nodeEnter.append('circle')
      .attr('r', 20)
      .attr('fill', d => {
        const colors = {
          critical: '#f44336',
          high: '#ff9800',
          medium: '#ffc107',
          low: '#4caf50'
        };
        return colors[d.risk] || '#2196f3';
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 2);
    
    // Add icons
    nodeEnter.append('text')
      .attr('font-family', 'Material Icons')
      .attr('font-size', '16px')
      .attr('fill', 'white')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.3em')
      .text(d => {
        const icons = {
          server: '\\e30a',
          workstation: '\\e30b',
          router: '\\e328',
          firewall: '\\e32a'
        };
        return icons[d.type] || '\\e30b';
      });
    
    // Add labels
    nodeEnter.append('text')
      .attr('dy', 35)
      .attr('text-anchor', 'middle')
      .attr('fill', '#fff')
      .attr('font-size', '12px')
      .text(d => d.ip);
    
    // Add click handler
    nodeEnter.on('click', (event, d) => {
      setSelectedNode(d);
      fetchNodeDetails(d.ip);
    });
    
    // Update simulation
    d3Simulation.current.nodes(networkData.nodes);
    d3Simulation.current.force('link').links(networkData.links);
    d3Simulation.current.alpha(0.3).restart();
    
    d3Simulation.current.on('tick', () => {
      g.selectAll('.link')
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);
      
      g.selectAll('.node')
        .attr('transform', d => `translate(${d.x},${d.y})`);
    });
    
    function dragstarted(event, d) {
      if (!event.active) d3Simulation.current.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }
    
    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }
    
    function dragended(event, d) {
      if (!event.active) d3Simulation.current.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }
  }, [networkData]);

  // Update graph when data changes
  useEffect(() => {
    updateNetworkGraph();
  }, [networkData, updateNetworkGraph]);

  // Fetch node details
  const fetchNodeDetails = async (ip) => {
    try {
      const response = await axios.get(`${API_URL}/api/hosts/${ip}`);
      setSelectedNode(response.data);
    } catch (error) {
      console.error('Failed to fetch host details:', error);
    }
  };

  // Start network scan
  const startScan = async () => {
    setScanning(true);
    showNotification('Starting network discovery...', 'info');
    
    try {
      await axios.post(`${API_URL}/api/scanner/discover`, { subnet });
    } catch (error) {
      console.error('Scan failed:', error);
      showNotification('Scan failed: ' + error.message, 'error');
      setScanning(false);
    }
  };

  // Fetch logs
  const fetchLogs = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/logs?limit=100`);
      setLogs(response.data);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    }
  };

  // Apply remediation
  const applyRemediation = async (hostIp, vulnId, action) => {
    try {
      await axios.post(`${API_URL}/api/remediate`, {
        hostIp,
        vulnerabilityId: vulnId,
        action
      });
      showNotification('Remediation applied successfully', 'success');
      if (selectedNode) {
        fetchNodeDetails(selectedNode.ip);
      }
    } catch (error) {
      console.error('Remediation failed:', error);
      showNotification('Remediation failed', 'error');
    }
  };

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      fetchLogs();
    }, 5000);
    
    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Render content based on active tab
  const renderTabContent = () => {
    switch (activeTab) {
      case 0:
        return renderNetworkTopology();
      case 1:
        return renderDashboard();
      case 2:
        return renderVulnerabilities();
      case 3:
        return renderPolicies();
      case 4:
        return renderReports();
      default:
        return null;
    }
  };

  // Render Network Topology
  const renderNetworkTopology = () => (
    <Box>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Network Subnet (CIDR)"
              value={subnet}
              onChange={(e) => setSubnet(e.target.value)}
              placeholder="192.168.1.0/24"
              disabled={scanning}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <Button
              variant="contained"
              color="primary"
              startIcon={scanning ? <Stop /> : <PlayArrow />}
              onClick={startScan}
              disabled={scanning}
              fullWidth
            >
              {scanning ? 'Scanning...' : 'Start Network Discovery'}
            </Button>
          </Grid>
        </Grid>
        {scanning && <LinearProgress sx={{ mt: 2 }} />}
      </Paper>
      
      <Grid container spacing={2}>
        <Grid item xs={12} lg={selectedNode ? 8 : 12}>
          <Paper sx={{ p: 2, height: 600, position: 'relative' }}>
            <Typography variant="h6" gutterBottom>
              Network Topology
            </Typography>
            <svg
              ref={svgRef}
              width="100%"
              height="500"
              style={{ background: '#0a0e1a', borderRadius: 4 }}
            />
            <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
              <Chip
                icon={<Computer />}
                label={`${networkData.nodes.length} Hosts`}
                color="primary"
              />
              <Chip
                icon={<Router />}
                label={`${networkData.links.length} Connections`}
                color="secondary"
              />
            </Box>
          </Paper>
        </Grid>
        
        {selectedNode && (
          <Grid item xs={12} lg={4}>
            <Paper sx={{ p: 2, height: 600, overflow: 'auto' }}>
              <Typography variant="h6" gutterBottom>
                Host Details: {selectedNode.ip}
              </Typography>
              <Divider sx={{ my: 1 }} />
              
              <List dense>
                <ListItem>
                  <ListItemText
                    primary="Hostname"
                    secondary={selectedNode.hostname || 'Unknown'}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Operating System"
                    secondary={selectedNode.os || 'Unknown'}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="MAC Address"
                    secondary={selectedNode.mac || 'Unknown'}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Device Type"
                    secondary={selectedNode.type || 'Unknown'}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Risk Level"
                    secondary={
                      <Chip
                        size="small"
                        label={selectedNode.risk || 'Unknown'}
                        color={
                          selectedNode.risk === 'critical' ? 'error' :
                          selectedNode.risk === 'high' ? 'warning' :
                          'success'
                        }
                      />
                    }
                  />
                </ListItem>
              </List>
              
              {selectedNode.services && selectedNode.services.length > 0 && (
                <>
                  <Typography variant="subtitle1" sx={{ mt: 2 }}>
                    Services ({selectedNode.services.length})
                  </Typography>
                  <List dense>
                    {selectedNode.services.map((service, idx) => (
                      <ListItem key={idx}>
                        <ListItemIcon>
                          <Storage fontSize="small" />
                        </ListItemIcon>
                        <ListItemText
                          primary={`${service.name} (Port ${service.port})`}
                          secondary={service.version}
                        />
                      </ListItem>
                    ))}
                  </List>
                </>
              )}
              
              {selectedNode.vulnerabilities && selectedNode.vulnerabilities.length > 0 && (
                <>
                  <Typography variant="subtitle1" sx={{ mt: 2 }}>
                    Vulnerabilities ({selectedNode.vulnerabilities.length})
                  </Typography>
                  <List dense>
                    {selectedNode.vulnerabilities.map((vuln, idx) => (
                      <ListItem key={idx}>
                        <ListItemIcon>
                          <BugReport
                            color={vuln.severity === 'critical' ? 'error' : 'warning'}
                            fontSize="small"
                          />
                        </ListItemIcon>
                        <ListItemText
                          primary={vuln.name}
                          secondary={`${vuln.id} - CVSS: ${vuln.cvss}`}
                        />
                        {vuln.status === 'open' && (
                          <IconButton
                            size="small"
                            onClick={() => applyRemediation(selectedNode.ip, vuln.id, 'patch')}
                            title="Apply Remediation"
                          >
                            <CheckCircle color="success" />
                          </IconButton>
                        )}
                      </ListItem>
                    ))}
                  </List>
                </>
              )}
            </Paper>
          </Grid>
        )}
      </Grid>
    </Box>
  );

  // Render Dashboard
  const renderDashboard = () => (
    <Grid container spacing={3}>
      <Grid item xs={12} md={3}>
        <Card>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              Total Scans
            </Typography>
            <Typography variant="h4">
              {metrics.totalScans}
            </Typography>
            <LinearProgress
              variant="determinate"
              value={100}
              sx={{ mt: 1 }}
            />
          </CardContent>
        </Card>
      </Grid>
      
      <Grid item xs={12} md={3}>
        <Card>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              Hosts Discovered
            </Typography>
            <Typography variant="h4" color="primary">
              {metrics.hostsDiscovered}
            </Typography>
            <LinearProgress
              variant="determinate"
              value={metrics.hostsDiscovered * 2}
              sx={{ mt: 1 }}
            />
          </CardContent>
        </Card>
      </Grid>
      
      <Grid item xs={12} md={3}>
        <Card>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              Vulnerabilities
            </Typography>
            <Typography variant="h4" color="error">
              {metrics.vulnerabilitiesFound}
            </Typography>
            <LinearProgress
              variant="determinate"
              value={metrics.vulnerabilitiesFound * 5}
              color="error"
              sx={{ mt: 1 }}
            />
          </CardContent>
        </Card>
      </Grid>
      
      <Grid item xs={12} md={3}>
        <Card>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              Remediations
            </Typography>
            <Typography variant="h4" color="success.main">
              {metrics.remediationsApplied}
            </Typography>
            <LinearProgress
              variant="determinate"
              value={metrics.remediationsApplied * 10}
              color="success"
              sx={{ mt: 1 }}
            />
          </CardContent>
        </Card>
      </Grid>
      
      <Grid item xs={12} md={8}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Security Trend Analysis
          </Typography>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={generateTrendData()}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <RechartsTooltip />
              <Legend />
              <Area
                type="monotone"
                dataKey="vulnerabilities"
                stroke="#f44336"
                fill="#f44336"
                fillOpacity={0.3}
              />
              <Area
                type="monotone"
                dataKey="remediations"
                stroke="#4caf50"
                fill="#4caf50"
                fillOpacity={0.3}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Paper>
      </Grid>
      
      <Grid item xs={12} md={4}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Risk Distribution
          </Typography>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={generateRiskData()}
                cx="50%"
                cy="50%"
                labelLine={false}
                label
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {generateRiskData().map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <RechartsTooltip />
            </PieChart>
          </ResponsiveContainer>
        </Paper>
      </Grid>
    </Grid>
  );

  // Render Vulnerabilities
  const renderVulnerabilities = () => (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Vulnerability Management
      </Typography>
      <DataGrid
        rows={generateVulnerabilityRows()}
        columns={[
          { field: 'id', headerName: 'CVE ID', width: 150 },
          { field: 'name', headerName: 'Name', width: 200 },
          { field: 'host', headerName: 'Host', width: 150 },
          {
            field: 'severity',
            headerName: 'Severity',
            width: 120,
            renderCell: (params) => (
              <Chip
                size="small"
                label={params.value}
                color={
                  params.value === 'critical' ? 'error' :
                  params.value === 'high' ? 'warning' :
                  'default'
                }
              />
            )
          },
          { field: 'cvss', headerName: 'CVSS', width: 100 },
          {
            field: 'status',
            headerName: 'Status',
            width: 120,
            renderCell: (params) => (
              <Chip
                size="small"
                label={params.value}
                color={params.value === 'open' ? 'error' : 'success'}
              />
            )
          },
          {
            field: 'actions',
            headerName: 'Actions',
            width: 150,
            renderCell: (params) => (
              <Button
                size="small"
                variant="contained"
                onClick={() => applyRemediation(params.row.host, params.row.id, 'patch')}
                disabled={params.row.status !== 'open'}
              >
                Remediate
              </Button>
            )
          }
        ]}
        pageSize={10}
        rowsPerPageOptions={[10, 25, 50]}
        checkboxSelection
        disableSelectionOnClick
        autoHeight
      />
    </Paper>
  );

  // Render Policies
  const renderPolicies = () => (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Security Policies & Compliance
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <Alert severity="info">
            Configure and enforce security policies based on industry frameworks
          </Alert>
        </Grid>
        <Grid item xs={12}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Policy Name</TableCell>
                  <TableCell>Framework</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Compliance</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {generatePolicyRows().map((policy) => (
                  <TableRow key={policy.id}>
                    <TableCell>{policy.name}</TableCell>
                    <TableCell>{policy.framework}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={policy.status}
                        color={policy.status === 'active' ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell>{policy.compliance}%</TableCell>
                    <TableCell>
                      <Button size="small">Edit</Button>
                      <Button size="small" color="error">Disable</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Grid>
      </Grid>
    </Paper>
  );

  // Render Reports
  const renderReports = () => (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Executive Reports & Analytics
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <Button variant="contained" startIcon={<Download />} sx={{ mr: 1 }}>
            Generate Security Report
          </Button>
          <Button variant="outlined" startIcon={<Assessment />} sx={{ mr: 1 }}>
            Compliance Report
          </Button>
          <Button variant="outlined" startIcon={<Timeline />}>
            Trend Analysis
          </Button>
        </Grid>
      </Grid>
    </Paper>
  );

  // Helper functions for generating mock data
  const generateTrendData = () => {
    const data = [];
    for (let i = 0; i < 7; i++) {
      data.push({
        time: moment().subtract(6 - i, 'days').format('MMM DD'),
        vulnerabilities: Math.floor(Math.random() * 20) + 10,
        remediations: Math.floor(Math.random() * 15) + 5
      });
    }
    return data;
  };

  const generateRiskData = () => [
    { name: 'Critical', value: 5, color: '#f44336' },
    { name: 'High', value: 12, color: '#ff9800' },
    { name: 'Medium', value: 23, color: '#ffc107' },
    { name: 'Low', value: 35, color: '#4caf50' }
  ];

  const generateVulnerabilityRows = () => {
    const rows = [];
    networkData.nodes.forEach(node => {
      if (node.vulnerabilities) {
        node.vulnerabilities.forEach(vuln => {
          rows.push({
            ...vuln,
            host: node.ip
          });
        });
      }
    });
    return rows;
  };

  const generatePolicyRows = () => [
    { id: 1, name: 'Password Complexity', framework: 'NIST CSF', status: 'active', compliance: 95 },
    { id: 2, name: 'Network Segmentation', framework: 'ISO 27001', status: 'active', compliance: 88 },
    { id: 3, name: 'Patch Management', framework: 'CIS Controls', status: 'active', compliance: 72 },
    { id: 4, name: 'Access Control', framework: 'NIST CSF', status: 'active', compliance: 91 }
  ];

  return (
    <Box sx={{ flexGrow: 1, minHeight: '100vh', background: 'linear-gradient(135deg, #0f1419 0%, #1a2332 100%)' }}>
      <AppBar position="static" sx={{ background: 'rgba(0,0,0,0.8)' }}>
        <Toolbar>
          <Security sx={{ mr: 2 }} />
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Guardian Security Platform - Enterprise Cybersecurity Management
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                color="secondary"
              />
            }
            label="Auto Refresh"
          />
          <IconButton color="inherit" onClick={fetchLogs}>
            <Refresh />
          </IconButton>
          <IconButton color="inherit" onClick={() => setShowLogs(!showLogs)}>
            <Badge badgeContent={logs.length} color="error">
              <Terminal />
            </Badge>
          </IconButton>
          <IconButton color="inherit">
            <Settings />
          </IconButton>
        </Toolbar>
        <Tabs
          value={activeTab}
          onChange={(e, v) => setActiveTab(v)}
          sx={{ background: 'rgba(255,255,255,0.05)' }}
        >
          <Tab icon={<NetworkCheck />} label="Network Topology" />
          <Tab icon={<Dashboard />} label="Dashboard" />
          <Tab icon={<BugReport />} label="Vulnerabilities" />
          <Tab icon={<Policy />} label="Policies" />
          <Tab icon={<Assessment />} label="Reports" />
        </Tabs>
      </AppBar>
      
      <Box sx={{ p: 3 }}>
        {renderTabContent()}
      </Box>
      
      <Drawer
        anchor="right"
        open={showLogs}
        onClose={() => setShowLogs(false)}
        PaperProps={{
          sx: { width: 600, background: '#0f1419' }
        }}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ color: 'white', mb: 2 }}>
            System Logs
          </Typography>
          <List>
            {logs.map((log) => (
              <ListItem key={log.id}>
                <ListItemIcon>
                  {log.level === 'error' ? <ErrorIcon color="error" /> :
                   log.level === 'warning' ? <Warning color="warning" /> :
                   log.level === 'info' ? <Info color="info" /> :
                   <CheckCircle color="success" />}
                </ListItemIcon>
                <ListItemText
                  primary={log.message}
                  secondary={moment(log.timestamp).format('YYYY-MM-DD HH:mm:ss')}
                  sx={{ color: 'white' }}
                />
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>
      
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={() => setNotification({ ...notification, open: false })}
      >
        <Alert
          onClose={() => setNotification({ ...notification, open: false })}
          severity={notification.severity}
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default GuardianPlatform;