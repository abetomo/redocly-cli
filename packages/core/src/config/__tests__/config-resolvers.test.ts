import { colorize } from '../../logger';
import { Asserts, asserts } from '../../rules/common/assertions/asserts';
import { resolveStyleguideConfig, resolveApis, resolveConfig } from '../config-resolvers';
const path = require('path');

import type { StyleguideRawConfig, RawConfig } from '../types';

const configPath = path.join(__dirname, 'fixtures/resolve-config/redocly.yaml');
const baseStyleguideConfig: StyleguideRawConfig = {
  rules: {
    'operation-2xx-response': 'warn',
  },
};

const minimalStyleguidePreset = resolveStyleguideConfig({
  styleguideConfig: { ...baseStyleguideConfig, extends: ['minimal'] },
});

const recommendedStyleguidePreset = resolveStyleguideConfig({
  styleguideConfig: { ...baseStyleguideConfig, extends: ['recommended'] },
});

const removeAbsolutePath = (item: string) =>
  item.match(/^.*\/packages\/core\/src\/config\/__tests__\/fixtures\/(.*)$/)![1];

describe('resolveStyleguideConfig', () => {
  it('should return the config with no recommended', async () => {
    const styleguide = await resolveStyleguideConfig({ styleguideConfig: baseStyleguideConfig });
    expect(styleguide.plugins?.length).toEqual(1);
    expect(styleguide.plugins?.[0].id).toEqual('');
    expect(styleguide.rules).toEqual({
      'operation-2xx-response': 'warn',
    });
  });

  it('should return the config with correct order by preset', async () => {
    expect(
      await resolveStyleguideConfig({
        styleguideConfig: { ...baseStyleguideConfig, extends: ['minimal', 'recommended'] },
      })
    ).toEqual(await recommendedStyleguidePreset);
    expect(
      await resolveStyleguideConfig({
        styleguideConfig: { ...baseStyleguideConfig, extends: ['recommended', 'minimal'] },
      })
    ).toEqual(await minimalStyleguidePreset);
  });

  it('should return the same styleguideConfig when extends is empty array', async () => {
    const configWithEmptyExtends = await resolveStyleguideConfig({
      styleguideConfig: { ...baseStyleguideConfig, extends: [] },
    });
    expect(configWithEmptyExtends.plugins?.length).toEqual(1);
    expect(configWithEmptyExtends.plugins?.[0].id).toEqual('');
    expect(configWithEmptyExtends.rules).toEqual({
      'operation-2xx-response': 'warn',
    });
  });

  it('should resolve extends with local file config', async () => {
    const config = {
      ...baseStyleguideConfig,
      extends: ['local-config.yaml'],
    };

    const { plugins, ...styleguide } = await resolveStyleguideConfig({
      styleguideConfig: config,
      configPath,
    });

    expect(styleguide?.rules?.['operation-2xx-response']).toEqual('warn');
    expect(plugins).toBeDefined();
    expect(plugins?.length).toBe(2);

    expect(styleguide.extendPaths!.map(removeAbsolutePath)).toEqual([
      'resolve-config/redocly.yaml',
      'resolve-config/local-config.yaml',
      'resolve-config/redocly.yaml',
    ]);
    expect(styleguide.pluginPaths!.map(removeAbsolutePath)).toEqual(['resolve-config/plugin.js']);

    expect(styleguide.rules).toEqual({
      'boolean-parameter-prefixes': 'error',
      'local/operation-id-not-test': 'error',
      'no-invalid-media-type-examples': 'error',
      'operation-2xx-response': 'warn',
      'operation-description': 'error',
      'path-http-verbs-order': 'error',
    });
  });

  // TODO: fix circular test
  it.skip('should throw circular error', () => {
    const config = {
      ...baseStyleguideConfig,
      extends: ['local-config-with-circular.yaml'],
    };
    expect(() => {
      resolveStyleguideConfig({ styleguideConfig: config, configPath });
    }).toThrow('Circular dependency in config file');
  });

  it('should resolve extends with local file config which contains path to nested config', async () => {
    const styleguideConfig = {
      extends: ['local-config-with-file.yaml'],
    };
    const { plugins, ...styleguide } = await resolveStyleguideConfig({
      styleguideConfig,
      configPath,
    });

    expect(styleguide?.rules?.['no-invalid-media-type-examples']).toEqual('warn');
    expect(styleguide?.rules?.['operation-4xx-response']).toEqual('off');
    expect(styleguide?.rules?.['operation-2xx-response']).toEqual('error');
    expect(plugins).toBeDefined();
    expect(plugins?.length).toBe(3);

    expect(styleguide.extendPaths!.map(removeAbsolutePath)).toEqual([
      'resolve-config/redocly.yaml',
      'resolve-config/local-config-with-file.yaml',
      'resolve-config/api/nested-config.yaml',
      'resolve-config/redocly.yaml',
    ]);
    expect(styleguide.pluginPaths!.map(removeAbsolutePath)).toEqual([
      'resolve-config/api/plugin.js',
      'resolve-config/plugin.js',
      'resolve-config/api/plugin.js',
    ]);

    delete styleguide.extendPaths;
    delete styleguide.pluginPaths;
    expect(styleguide).toMatchSnapshot();
  });

  it('should resolve custom assertion from plugin', async () => {
    const styleguideConfig = {
      extends: ['local-config-with-custom-function.yaml'],
    };
    const { plugins } = await resolveStyleguideConfig({
      styleguideConfig,
      configPath,
    });

    expect(plugins).toBeDefined();
    expect(plugins?.length).toBe(2);
    expect(asserts['test-plugin/checkWordsCount' as keyof Asserts]).toBeDefined();
  });

  it('should throw error when custom assertion load not exist plugin', async () => {
    const styleguideConfig = {
      extends: ['local-config-with-wrong-custom-function.yaml'],
    };
    try {
      await resolveStyleguideConfig({
        styleguideConfig,
        configPath,
      });
    } catch (e) {
      expect(e.message.toString()).toContain(
        `Plugin ${colorize.red(
          'test-plugin'
        )} doesn't export assertions function with name ${colorize.red('checkWordsCount2')}.`
      );
    }

    expect(asserts['test-plugin/checkWordsCount' as keyof Asserts]).toBeDefined();
  });

  it('should correctly merge assertions from nested config', async () => {
    const styleguideConfig = {
      extends: ['local-config-with-file.yaml'],
    };

    const styleguide = await resolveStyleguideConfig({
      styleguideConfig,
      configPath,
    });

    expect(Array.isArray(styleguide.rules?.assertions)).toEqual(true);
    expect(styleguide.rules?.assertions).toMatchObject([
      {
        subject: 'PathItem',
        property: 'get',
        message: 'Every path item must have a GET operation.',
        defined: true,
        assertionId: 'path-item-get-defined',
      },
      {
        subject: 'Tag',
        property: 'description',
        message: 'Tag description must be at least 13 characters and end with a full stop.',
        severity: 'error',
        minLength: 13,
        pattern: '/\\.$/',
        assertionId: 'tag-description',
      },
    ]);
  });

  it('should resolve extends with url file config which contains path to nested config', async () => {
    const styleguideConfig = {
      // This points to ./fixtures/resolve-remote-configs/remote-config.yaml
      extends: [
        'https://raw.githubusercontent.com/Redocly/redocly-cli/main/packages/core/src/config/__tests__/fixtures/resolve-remote-configs/remote-config.yaml',
      ],
    };

    const { plugins, ...styleguide } = await resolveStyleguideConfig({
      styleguideConfig,
      configPath,
    });

    expect(styleguide?.rules?.['operation-4xx-response']).toEqual('error');
    expect(styleguide?.rules?.['operation-2xx-response']).toEqual('error');
    expect(Object.keys(styleguide.rules || {}).length).toBe(2);

    expect(styleguide.extendPaths!.map(removeAbsolutePath)).toEqual([
      'resolve-config/redocly.yaml',
      'resolve-config/redocly.yaml',
    ]);
    expect(styleguide.pluginPaths!.map(removeAbsolutePath)).toEqual([]);
  });
});

describe('resolveApis', () => {
  it('should resolve apis styleguideConfig and merge minimal extends', async () => {
    const rawConfig: RawConfig = {
      apis: {
        petstore: {
          root: 'some/path',
          styleguide: {},
        },
      },
      styleguide: {
        extends: ['minimal'],
      },
    };
    const apisResult = await resolveApis({ rawConfig });
    expect(apisResult['petstore'].styleguide).toEqual(await minimalStyleguidePreset);
  });

  it('should not merge recommended extends by default by every level', async () => {
    const rawConfig: RawConfig = {
      apis: {
        petstore: {
          root: 'some/path',
          styleguide: {},
        },
      },
      styleguide: {},
    };

    const apisResult = await resolveApis({ rawConfig, configPath });

    expect(apisResult['petstore'].styleguide.extendPaths!.map(removeAbsolutePath)).toEqual([
      'resolve-config/redocly.yaml',
    ]);
    expect(apisResult['petstore'].styleguide.pluginPaths!.map(removeAbsolutePath)).toEqual([]);

    expect(apisResult['petstore'].styleguide.rules).toEqual({});
    //@ts-ignore
    expect(apisResult['petstore'].styleguide.plugins.length).toEqual(1);
    //@ts-ignore
    expect(apisResult['petstore'].styleguide.plugins[0].id).toEqual('');
  });

  it('should resolve apis styleguideConfig when it contains file and not set recommended', async () => {
    const rawConfig: RawConfig = {
      apis: {
        petstore: {
          root: 'some/path',
          styleguide: {
            rules: {
              'operation-4xx-response': 'error',
            },
          },
        },
      },
      styleguide: {
        rules: {
          'operation-2xx-response': 'warn',
        },
      },
    };

    const apisResult = await resolveApis({ rawConfig, configPath });
    expect(apisResult['petstore'].styleguide.rules).toEqual({
      'operation-2xx-response': 'warn',
      'operation-4xx-response': 'error',
    });
    //@ts-ignore
    expect(apisResult['petstore'].styleguide.plugins.length).toEqual(1);
    //@ts-ignore
    expect(apisResult['petstore'].styleguide.plugins[0].id).toEqual('');

    expect(apisResult['petstore'].styleguide.extendPaths!.map(removeAbsolutePath)).toEqual([
      'resolve-config/redocly.yaml',
    ]);
    expect(apisResult['petstore'].styleguide.pluginPaths!.map(removeAbsolutePath)).toEqual([]);
  });

  it('should resolve apis styleguideConfig when it contains file', async () => {
    const rawConfig: RawConfig = {
      apis: {
        petstore: {
          root: 'some/path',
          styleguide: {
            extends: ['local-config.yaml'],
            rules: {
              'operation-4xx-response': 'error',
            },
          },
        },
      },
      styleguide: {
        extends: ['minimal'],
        rules: {
          'operation-2xx-response': 'warn',
        },
      },
    };

    const apisResult = await resolveApis({ rawConfig, configPath });
    expect(apisResult['petstore'].styleguide.rules).toBeDefined();
    expect(apisResult['petstore'].styleguide.rules?.['operation-2xx-response']).toEqual('warn'); // think about prioritize in merge ???
    expect(apisResult['petstore'].styleguide.rules?.['operation-4xx-response']).toEqual('error');
    expect(apisResult['petstore'].styleguide.rules?.['local/operation-id-not-test']).toEqual(
      'error'
    );
    //@ts-ignore
    expect(apisResult['petstore'].styleguide.plugins.length).toEqual(2);

    expect(apisResult['petstore'].styleguide.extendPaths!.map(removeAbsolutePath)).toEqual([
      'resolve-config/redocly.yaml',
      'resolve-config/local-config.yaml',
      'resolve-config/redocly.yaml',
    ]);
    expect(apisResult['petstore'].styleguide.pluginPaths!.map(removeAbsolutePath)).toEqual([
      'resolve-config/plugin.js',
    ]);
  });
});

describe('resolveConfig', () => {
  it('should NOT add recommended to top level by default IF there is a config file', async () => {
    const rawConfig: RawConfig = {
      apis: {
        petstore: {
          root: 'some/path',
          styleguide: {
            rules: {
              'operation-4xx-response': 'error',
            },
          },
        },
      },
      styleguide: {
        rules: {
          'operation-2xx-response': 'warn',
        },
      },
    };

    const { apis } = await resolveConfig(rawConfig, configPath);
    //@ts-ignore
    expect(apis['petstore'].styleguide.plugins.length).toEqual(1);
    //@ts-ignore
    expect(apis['petstore'].styleguide.plugins[0].id).toEqual('');

    expect(apis['petstore'].styleguide.extendPaths!.map(removeAbsolutePath)).toEqual([
      'resolve-config/redocly.yaml',
    ]);
    expect(apis['petstore'].styleguide.pluginPaths!.map(removeAbsolutePath)).toEqual([]);

    expect(apis['petstore'].styleguide.rules).toEqual({
      'operation-2xx-response': 'warn',
      'operation-4xx-response': 'error',
    });
  });

  it('should not add recommended to top level by default when apis have extends file', async () => {
    const rawConfig: RawConfig = {
      apis: {
        petstore: {
          root: 'some/path',
          styleguide: {
            extends: ['local-config.yaml'],
            rules: {
              'operation-4xx-response': 'error',
            },
          },
        },
      },
      styleguide: {
        rules: {
          'operation-2xx-response': 'warn',
        },
      },
    };

    const { apis } = await resolveConfig(rawConfig, configPath);
    expect(apis['petstore'].styleguide.rules).toBeDefined();
    expect(Object.keys(apis['petstore'].styleguide.rules || {}).length).toEqual(7);
    expect(apis['petstore'].styleguide.rules?.['operation-2xx-response']).toEqual('warn');
    expect(apis['petstore'].styleguide.rules?.['operation-4xx-response']).toEqual('error');
    expect(apis['petstore'].styleguide.rules?.['operation-description']).toEqual('error'); // from extends file config
    //@ts-ignore
    expect(apis['petstore'].styleguide.plugins.length).toEqual(2);

    expect(apis['petstore'].styleguide.extendPaths!.map(removeAbsolutePath)).toEqual([
      'resolve-config/redocly.yaml',
      'resolve-config/local-config.yaml',
      'resolve-config/redocly.yaml',
    ]);
    expect(apis['petstore'].styleguide.pluginPaths!.map(removeAbsolutePath)).toEqual([
      'resolve-config/plugin.js',
    ]);

    expect(apis['petstore'].styleguide.recommendedFallback).toBe(false);
  });

  it('should ignore minimal from the root and read local file', async () => {
    const rawConfig: RawConfig = {
      apis: {
        petstore: {
          root: 'some/path',
          styleguide: {
            extends: ['recommended', 'local-config.yaml'],
            rules: {
              'operation-4xx-response': 'error',
            },
          },
        },
      },
      styleguide: {
        extends: ['minimal'],
        rules: {
          'operation-2xx-response': 'warn',
        },
      },
    };

    const { apis } = await resolveConfig(rawConfig, configPath);
    expect(apis['petstore'].styleguide.rules).toBeDefined();
    expect(apis['petstore'].styleguide.rules?.['operation-2xx-response']).toEqual('warn');
    expect(apis['petstore'].styleguide.rules?.['operation-4xx-response']).toEqual('error');
    expect(apis['petstore'].styleguide.rules?.['operation-description']).toEqual('error'); // from extends file config
    //@ts-ignore
    expect(apis['petstore'].styleguide.plugins.length).toEqual(2);
    //@ts-ignore
    delete apis['petstore'].styleguide.plugins;

    expect(apis['petstore'].styleguide.extendPaths!.map(removeAbsolutePath)).toEqual([
      'resolve-config/redocly.yaml',
      'resolve-config/local-config.yaml',
      'resolve-config/redocly.yaml',
    ]);
    expect(apis['petstore'].styleguide.pluginPaths!.map(removeAbsolutePath)).toEqual([
      'resolve-config/plugin.js',
    ]);

    delete apis['petstore'].styleguide.extendPaths;
    delete apis['petstore'].styleguide.pluginPaths;
    expect(apis['petstore'].styleguide).toMatchSnapshot();
  });

  it('should default to the extends from the main config if no extends defined', async () => {
    const rawConfig: RawConfig = {
      apis: {
        petstore: {
          root: 'some/path',
          styleguide: {
            rules: {
              'operation-4xx-response': 'error',
            },
          },
        },
      },
      styleguide: {
        extends: ['minimal'],
        rules: {
          'operation-2xx-response': 'warn',
        },
      },
    };

    const { apis } = await resolveConfig(rawConfig, configPath);
    expect(apis['petstore'].styleguide.rules).toBeDefined();
    expect(apis['petstore'].styleguide.rules?.['operation-2xx-response']).toEqual('warn'); // from minimal ruleset
  });
});
