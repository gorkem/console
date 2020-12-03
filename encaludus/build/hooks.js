const fse = require('fs-extra')

module.exports = {

  generateAssets: async (forgeConfig, options) => {
    fse.copySync('../bin', './bin')
    fse.ensureDirSync('./frontend/public/dist')
    fse.copySync('../frontend/public/dist', './frontend/public/dist')
    fse.ensureDirSync('./pkg/graphql')
    fse.copySync('../pkg/graphql/schema.graphql','./pkg/graphql/schema.graphql')
  }

};
