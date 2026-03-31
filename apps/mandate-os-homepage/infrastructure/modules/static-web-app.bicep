targetScope = 'resourceGroup'

@description('Azure Static Web App resource name.')
param staticWebAppName string

@description('Azure region for the Static Web App.')
param location string

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

@description('Tags applied to the Static Web App.')
param tags object = {}

resource staticWebApp 'Microsoft.Web/staticSites@2022-09-01' = {
  name: staticWebAppName
  location: location
  tags: tags
  sku: {
    name: staticWebAppSkuName
    tier: staticWebAppSkuTier
  }
  properties: {}
}

output staticWebAppName string = staticWebApp.name
