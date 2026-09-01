import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as ecrAssets from 'aws-cdk-lib/aws-ecr-assets';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import * as path from 'path';

const DOMAIN_NAME = 'miturop.org';

export class UropStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC — dev-sized: 2 AZs, public subnets only (avoids NAT Gateway cost)
    const vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
      ],
    });

    // Secrets — stored in Secrets Manager, injected into the container at runtime
    const appSecrets = new secretsmanager.Secret(this, 'AppSecrets', {
      secretName: 'urop-search-engine/app',
      description: 'UROP Search Engine application secrets',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          MONGODB_URI: 'REPLACE_ME',
          ADMIN_SECRET: 'REPLACE_ME',
          GOOGLE_CLIENT_ID: 'REPLACE_ME',
          GOOGLE_CLIENT_SECRET: 'REPLACE_ME',
          SESSION_SECRET: 'REPLACE_ME',
        }),
        generateStringKey: '_generated',
      },
    });

    // ECS Cluster
    const cluster = new ecs.Cluster(this, 'Cluster', {
      vpc,
      clusterName: 'urop-cluster',
    });

    // Existing Route 53 hosted zone for the production domain
    const zone = route53.HostedZone.fromLookup(this, 'Zone', {
      domainName: DOMAIN_NAME,
    });

    // Fargate service with ALB
    const service = new ecsPatterns.ApplicationLoadBalancedFargateService(
      this,
      'Service',
      {
        cluster,
        cpu: 256,       // 0.25 vCPU
        memoryLimitMiB: 512,
        desiredCount: 1,
        assignPublicIp: true,
        domainName: DOMAIN_NAME,
        domainZone: zone,
        protocol: elbv2.ApplicationProtocol.HTTPS,
        redirectHTTP: true,
        runtimePlatform: {
          cpuArchitecture: ecs.CpuArchitecture.ARM64,
          operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
        },
        circuitBreaker: { rollback: true },
        taskImageOptions: {
          image: ecs.ContainerImage.fromAsset(path.join(__dirname, '../..'), {
            file: 'Dockerfile',
            platform: ecrAssets.Platform.LINUX_ARM64,
          }),
          containerPort: 3001,
          environment: {
            NODE_ENV: 'production',
            PORT: '3001',
          },
          secrets: {
            MONGODB_URI: ecs.Secret.fromSecretsManager(appSecrets, 'MONGODB_URI'),
            ADMIN_SECRET: ecs.Secret.fromSecretsManager(appSecrets, 'ADMIN_SECRET'),
            GOOGLE_CLIENT_ID: ecs.Secret.fromSecretsManager(appSecrets, 'GOOGLE_CLIENT_ID'),
            GOOGLE_CLIENT_SECRET: ecs.Secret.fromSecretsManager(appSecrets, 'GOOGLE_CLIENT_SECRET'),
            SESSION_SECRET: ecs.Secret.fromSecretsManager(appSecrets, 'SESSION_SECRET'),
          },
          logDriver: ecs.LogDrivers.awsLogs({
            streamPrefix: 'urop',
            logRetention: logs.RetentionDays.ONE_WEEK,
          }),
        },
        publicLoadBalancer: true,
        taskSubnets: {
          subnetType: ec2.SubnetType.PUBLIC,
        },
      }
    );

    // Health check on the API endpoint. Tightened from the CDK defaults
    // (5 passes × 30s = 150s before a task joins the load balancer) so a new
    // task starts serving in ~30s instead.
    service.targetGroup.configureHealthCheck({
      path: '/api/health',
      healthyHttpCodes: '200',
      interval: cdk.Duration.seconds(15),
      timeout: cdk.Duration.seconds(5),
      healthyThresholdCount: 2,
      unhealthyThresholdCount: 3,
    });

    // Drain time for a task leaving the load balancer. The AWS default of 300s
    // dominated deploy wall-clock — every rollout waited 5 minutes per draining
    // task. Requests here are short-lived, so 30s is ample.
    service.targetGroup.setAttribute('deregistration_delay.timeout_seconds', '30');

    // Allow outbound to MongoDB Atlas and Google OAuth
    service.service.connections.allowToAnyIpv4(
      ec2.Port.tcp(443),
      'HTTPS outbound (MongoDB Atlas, Google OAuth)'
    );

    // Inject the production domain as BACKEND_URL and APP_URL so OAuth callbacks work
    const taskDef = service.taskDefinition.defaultContainer!;
    taskDef.addEnvironment('BACKEND_URL', `https://${DOMAIN_NAME}`);
    taskDef.addEnvironment('APP_URL', `https://${DOMAIN_NAME}`);

    // Outputs
    new cdk.CfnOutput(this, 'AppUrl', {
      value: `https://${DOMAIN_NAME}`,
      description: 'Application URL',
    });

    new cdk.CfnOutput(this, 'LoadBalancerDns', {
      value: service.loadBalancer.loadBalancerDnsName,
      description: 'ALB DNS name (target of the Route 53 A-record)',
    });

    new cdk.CfnOutput(this, 'SecretArn', {
      value: appSecrets.secretArn,
      description: 'Update this secret with real values before deploying',
    });
  }
}
