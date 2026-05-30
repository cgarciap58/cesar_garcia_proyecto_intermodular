# Para copiar y pegar y obtener toda la info relevante en la consola de AWS

# VPCs
aws ec2 describe-vpcs \
  --query 'Vpcs[].{ID:VpcId,CIDR:CidrBlock,State:State}' \
  --output table

# Subnets
aws ec2 describe-subnets \
  --query 'Subnets[].{ID:SubnetId,CIDR:CidrBlock,AZ:AvailabilityZone,VPC:VpcId}' \
  --output table

# Route Tables
aws ec2 describe-route-tables \
  --query 'RouteTables[].{ID:RouteTableId,VPC:VpcId}' \
  --output table

aws ec2 describe-route-tables \
  --query 'RouteTables[].{
    ID:RouteTableId,
    VPC:VpcId,
    Routes:Routes[].{Dest:CidrBlock,Gateway:GatewayId,Nat:NatGatewayId,State:State},
    Associations:Associations[].SubnetId
  }' \
  --output table \
  --no-cli-pager

# Security Groups

aws ec2 describe-security-groups \
  --query 'SecurityGroups[].{
    ID:GroupId,
    Name:GroupName,
    VPC:VpcId,
    Inbound:IpPermissions
  }' \
  --output json \
  --no-cli-pager

# Instances

aws ec2 describe-instances \
  --query 'Reservations[].Instances[].{
    ID:InstanceId,
    Name:Tags[?Key==`Name`]|[0].Value,
    State:State.Name,
    Type:InstanceType,
    PrivateIP:PrivateIpAddress,
    Subnet:SubnetId,
    SGs:SecurityGroups[].GroupId
  }' \
  --output table \
  --no-cli-pager

# Network ACLs
aws ec2 describe-network-acls \
  --query 'NetworkAcls[].{ID:NetworkAclId,VPC:VpcId}' \
  --output table

# Internet Gateways
aws ec2 describe-internet-gateways \
  --query 'InternetGateways[].{ID:InternetGatewayId,VPCs:Attachments[].VpcId}' \
  --output table

# NAT Gateways

aws ec2 describe-nat-gateways \
  --query 'NatGateways[].{
    ID:NatGatewayId,
    State:State,
    Subnet:SubnetId,
    PublicIP:NatGatewayAddresses[].PublicIp
  }' \
  --output table
