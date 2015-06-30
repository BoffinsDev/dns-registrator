# DNS Registrator
Automatically creates a health check and weighted resource record set on Route53 with the public IP of your server.

The public IP is resolved using `myip.opendns.com`.

## Options
```
--hosted-zone-name [required]
--resource-record-set-domain-name [required]
--health-check-protocol [optional] (default: 'HTTP')
--health-check-port [optional] (default: 80)
--health-check-path [optional] (default: '/health-check')
--health-check-request-interval [optional] (default: 30)
--health-check-failure-threshold [optional] (default: 1)
--resource-record-set-type [optional] (default: 'A')
--resource-record-set-weight [optional] (default: 1)
--resource-record-set-ttl [optional] (default: 30)
```

## Example
```shell
docker run --rm \
  -e AWS_ACCESS_KEY_ID=<your key> \
  -e AWS_SECRET_ACCESS_KEY=<your secret> \
  boffins/dns-registrator \
  --hosted-zone-name yourdomain.com. \
  --resource-record-set-domain-name subdomain.yourdomain.com
```

## Limitations
Does not automatically remove health check and resource record set when shut down.

## Licence
MIT
