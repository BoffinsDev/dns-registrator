var child_process = require('child_process')
var aws = require('aws-sdk')
var _ = require('highland')
var cuid = require('cuid')
var nconf = require('nconf')

var route53 = _.streamifyAll(new aws.Route53())

nconf.argv().env().defaults({
  'health-check-protocol': 'HTTP',
  'health-check-port': 80,
  'health-check-path': '/health-check',
  'health-check-request-interval': 30,
  'health-check-failure-threshold': 1,
  'resource-record-set-type': 'A',
  'resource-record-set-weight': 1,
  'resource-record-set-ttl': 30
})

if (nconf.get('hosted-zone-name') === undefined) {
  throw new Error('Parameter --hosted-zone-name is required.')
}

if (nconf.get('resource-record-set-domain-name') === undefined) {
  throw new Error('Parameter --resource-record-set-domain-name is required.')
}

registerIP({
  hostedZone: {
    name: nconf.get('hosted-zone-name')
  },
  healthCheck: {
    protocol: nconf.get('health-check-protocol'),
    port: nconf.get('health-check-port'),
    path: nconf.get('health-check-path'),
    requestInterval: nconf.get('health-check-request-interval'),
    failureThreshold: nconf.get('health-check-failure-threshold')
  },
  resourceRecordSet: {
    domainName: nconf.get('resource-record-set-domain-name'),
    type: nconf.get('resource-record-set-type'),
    weight: nconf.get('resource-record-set-weight'),
    ttl: nconf.get('resource-record-set-ttl')
  }
}).pull(function(err) {
  if (err) {throw err}
})

function getPublicIP() {
  return _
    .wrapCallback(child_process.exec)('dig +short myip.opendns.com @resolver1.opendns.com')
    .split() // Remove newline character
    .head()
}

function getHostedZoneId(options) {
  return route53
    .listHostedZonesStream({})
    .map(function(results) {return results.HostedZones})
    .sequence()
    .filter(function(zone) {return zone.Name === options.name})
    .pluck('Id')
    .doto(function(id) {console.log('Hosted Zone ID:', id)})
}

function createHealthCheck(options) {
  return getPublicIP()
    .map(function(ip) {return {
      CallerReference: cuid(),
      HealthCheckConfig: {
        Type: options.protocol,
        FailureThreshold: options.failureThreshold,
        IPAddress: ip,
        Port: options.port,
        RequestInterval: options.interval,
        ResourcePath: options.path
      }
    }})
    .flatMap(function(params) {return route53.createHealthCheckStream(params)})
    .pluck('HealthCheck')
    .pluck('Id')
    .doto(function(id) {console.log('Health Check ID:', id)})
}

function registerIP(options) {
  var resourceRecordSetOptions = options.resourceRecordSet
  return getPublicIP()
    .zipAll([
      getHostedZoneId(options.hostedZone),
      createHealthCheck(options.healthCheck)
    ])
    .map(function(results) {
      var ip = results[0]
      var zoneId = results[1]
      var healthCheckId = results[2]
      return {
        ChangeBatch: {
          Changes: [{
            Action: 'CREATE',
            ResourceRecordSet: {
              Name: resourceRecordSetOptions.domainName,
              Type: resourceRecordSetOptions.type,
              Weight: resourceRecordSetOptions.weight,
              HealthCheckId: healthCheckId,
              SetIdentifier: cuid(),
              ResourceRecords: [{Value: ip}],
              TTL: resourceRecordSetOptions.ttl
            }
          }],
          Comment: 'Updated automatically at ' + new Date().toGMTString()
        },
        HostedZoneId: zoneId
      }
    })
    .flatMap(function(params) {return route53.changeResourceRecordSetsStream(params)})
    .pluck('ChangeInfo')
    .pluck('Id')
    .doto(function(id) {console.log('Resource Record Set Change ID:', id)})
}
