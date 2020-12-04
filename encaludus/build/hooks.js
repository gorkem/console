const fse = require('fs-extra')
const path = require('path');
module.exports = {

  generateAssets: async (forgeConfig, options) => {
    fse.copySync(path.resolve('../bin'), path.resolve('./bin'))
    const distPath = path.resolve('./frontend/public/dist')
    fse.ensureDirSync(distPath)
    fse.copySync(path.resolve('../frontend/public/dist'), distPath)
    fse.ensureDirSync(path.resolve('./pkg/graphql'))
    fse.copySync(path.resolve('../pkg/graphql/schema.graphql'),path.resolve('./pkg/graphql/schema.graphql'))
  }
};
