targetScope = 'subscription'

@description('Resource group for the MandateOS homepage resources.')
param resourceGroupName string

@description('Azure location for the resource group and Static Web App.')
param location string = 'westeurope'

@description('Azure Static Web App resource name.')
param staticWebAppName string

@description('Static Web App SKU name.')
@allowed([
  'Free'
  'Standard'
])
param staticWebAppSkuName string = 'Free'

@description('Static Web App SKU tier.')
@allowed([
  'Free'
  'Standard'
])
param staticWebAppSkuTier string = 'Free'

@description('Tags applied to provisioned resources.')
param tags object = {}

resource appResourceGroup 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: resourceGroupName
  location: location
  tags: tags
}

module staticWebApp './modules/static-web-app.bicep' = {
  name: 'mandate-os-homepage-static-web-app'
  scope: resourceGroup(resourceGroupName)
  params: {
    staticWebAppName: staticWebAppName
    location: location
    staticWebAppSkuName: staticWebAppSkuName
    staticWebAppSkuTier: staticWebAppSkuTier
    tags: tags
  }
  dependsOn: [
    appResourceGroup
  ]
}

output resourceGroup string = appResourceGroup.name
output staticWebApp string = staticWebApp.outputs.staticWebAppName
