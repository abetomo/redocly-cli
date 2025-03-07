import {
  getFallbackApisOrExit,
  isSubdir,
  pathToFilename,
  printConfigLintTotals,
  langToExt,
  checkIfRulesetExist,
  handleError,
  CircularJSONNotSupportedError,
  sortTopLevelKeysForOas,
} from '../utils';
import {
  ResolvedApi,
  Totals,
  isAbsoluteUrl,
  ResolveError,
  YamlParseError,
  Oas3Definition,
} from '@redocly/openapi-core';
import { blue, red, yellow } from 'colorette';
import { existsSync } from 'fs';
import * as path from 'path';
import * as process from 'process';

jest.mock('os');
jest.mock('colorette');
jest.mock('fs');

describe('isSubdir', () => {
  it('can correctly determine if subdir', () => {
    (
      [
        ['/foo', '/foo', false],
        ['/foo', '/bar', false],
        ['/foo', '/foobar', false],
        ['/foo', '/foo/bar', true],
        ['/foo', '/foo/../bar', false],
        ['/foo', '/foo/./bar', true],
        ['/bar/../foo', '/foo/bar', true],
        ['/foo', './bar', false],
        ['/foo', '/foo/..bar', true],
      ] as [string, string, boolean][]
    ).forEach(([parent, child, expectRes]) => {
      expect(isSubdir(parent, child)).toBe(expectRes);
    });
  });

  it('can correctly determine if subdir for windows-based paths', () => {
    const os = require('os');
    os.platform.mockImplementation(() => 'win32');

    (
      [
        ['C:/Foo', 'C:/Foo/Bar', true],
        ['C:\\Foo', 'C:\\Bar', false],
        ['C:\\Foo', 'D:\\Foo\\Bar', false],
      ] as [string, string, boolean][]
    ).forEach(([parent, child, expectRes]) => {
      expect(isSubdir(parent, child)).toBe(expectRes);
    });
  });

  afterEach(() => {
    jest.resetModules();
  });
});

describe('pathToFilename', () => {
  it('should use correct path separator', () => {
    const processedPath = pathToFilename('/user/createWithList', '_');
    expect(processedPath).toEqual('user_createWithList');
  });
});

describe('getFallbackApisOrExit', () => {
  it('should find alias by filename', async () => {
    (existsSync as jest.Mock<any, any>).mockImplementationOnce(() => true);
    const entry = await getFallbackApisOrExit(['./test.yaml'], {
      apis: {
        main: {
          root: 'test.yaml',
        },
      },
    } as any);
    expect(entry).toEqual([{ path: './test.yaml', alias: 'main' }]);
  });
});

describe('printConfigLintTotals', () => {
  const totalProblemsMock: Totals = {
    errors: 1,
    warnings: 0,
    ignored: 0,
  };

  const redColoretteMocks = red as jest.Mock<any, any>;
  const yellowColoretteMocks = yellow as jest.Mock<any, any>;

  beforeEach(() => {
    yellowColoretteMocks.mockImplementation((text: string) => text);
    redColoretteMocks.mockImplementation((text: string) => text);
    jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  it('should print errors if such exist', () => {
    printConfigLintTotals(totalProblemsMock);
    expect(process.stderr.write).toHaveBeenCalledWith('❌ Your config has 1 error.\n');
    expect(redColoretteMocks).toHaveBeenCalledWith('❌ Your config has 1 error.\n');
  });

  it('should print warnign and error', () => {
    printConfigLintTotals({ ...totalProblemsMock, warnings: 2 });
    expect(process.stderr.write).toHaveBeenCalledWith(
      '❌ Your config has 1 error and 2 warnings.\n'
    );
    expect(redColoretteMocks).toHaveBeenCalledWith('❌ Your config has 1 error and 2 warnings.\n');
  });

  it('should print warnign if no error', () => {
    printConfigLintTotals({ ...totalProblemsMock, errors: 0, warnings: 2 });
    expect(process.stderr.write).toHaveBeenCalledWith('You have 2 warnings.\n');
    expect(yellowColoretteMocks).toHaveBeenCalledWith('You have 2 warnings.\n');
  });

  it('should print nothing if no error and no warnings', () => {
    const result = printConfigLintTotals({ ...totalProblemsMock, errors: 0 });
    expect(result).toBeUndefined();
    expect(process.stderr.write).toHaveBeenCalledTimes(0);
    expect(yellowColoretteMocks).toHaveBeenCalledTimes(0);
    expect(redColoretteMocks).toHaveBeenCalledTimes(0);
  });
});

describe('getFallbackApisOrExit', () => {
  const redColoretteMocks = red as jest.Mock<any, any>;
  const yellowColoretteMocks = yellow as jest.Mock<any, any>;

  const apis: Record<string, ResolvedApi> = {
    main: {
      root: 'someFile.yaml',
      styleguide: {},
    },
  };

  const config = { apis };

  beforeEach(() => {
    yellowColoretteMocks.mockImplementation((text: string) => text);
    redColoretteMocks.mockImplementation((text: string) => text);
    jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    jest.spyOn(process, 'exit').mockImplementation();
  });

  it('should exit with error because no path provided', async () => {
    const apisConfig = {
      apis: {},
    };
    await getFallbackApisOrExit([''], apisConfig);
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('should error if file from config do not exist', async () => {
    (existsSync as jest.Mock<any, any>).mockImplementationOnce(() => false);
    await getFallbackApisOrExit(undefined, config);

    expect(process.stderr.write).toHaveBeenCalledWith(
      '\n someFile.yaml does not exist or is invalid. Please provide a valid path. \n\n'
    );
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('should return valid array with results if such file exist', async () => {
    (existsSync as jest.Mock<any, any>).mockImplementationOnce(() => true);
    jest.spyOn(path, 'resolve').mockImplementationOnce((_, path) => path);

    const result = await getFallbackApisOrExit(undefined, config);
    expect(process.stderr.write).toHaveBeenCalledTimes(0);
    expect(process.exit).toHaveBeenCalledTimes(0);
    expect(result).toStrictEqual([
      {
        alias: 'main',
        path: 'someFile.yaml',
      },
    ]);
  });

  it('should exit with error in case if invalid path provided as args', async () => {
    const apisConfig = {
      apis: {},
    };
    (existsSync as jest.Mock<any, any>).mockImplementationOnce(() => false);
    await getFallbackApisOrExit(['someFile.yaml'], apisConfig);

    expect(process.stderr.write).toHaveBeenCalledWith(
      '\n someFile.yaml does not exist or is invalid. Please provide a valid path. \n\n'
    );
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('should exit with error in case if invalid 2 path provided as args', async () => {
    const apisConfig = {
      apis: {},
    };
    (existsSync as jest.Mock<any, any>).mockImplementationOnce(() => false);
    await getFallbackApisOrExit(['someFile.yaml', 'someFile2.yaml'], apisConfig);

    expect(process.stderr.write).lastCalledWith(
      '\n someFile2.yaml does not exist or is invalid. Please provide a valid path. \n\n'
    );
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('should exit with error if only one file exist ', async () => {
    const apisStub = {
      ...apis,
      notExist: {
        root: 'notExist.yaml',
        styleguide: {},
      },
    };
    const configStub = { apis: apisStub };

    (existsSync as jest.Mock<any, any>).mockImplementationOnce((path) => path === 'someFile.yaml');

    await getFallbackApisOrExit(undefined, configStub);

    expect(process.stderr.write).toBeCalledWith(
      '\n notExist.yaml does not exist or is invalid. Please provide a valid path. \n\n'
    );
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('should work ok if it is url passed', async () => {
    (existsSync as jest.Mock<any, any>).mockImplementationOnce(() => false);
    (isAbsoluteUrl as jest.Mock<any, any>).mockImplementation(() => true);
    const apisConfig = {
      apis: {
        main: {
          root: 'https://someLinkt/petstore.yaml?main',
          styleguide: {},
        },
      },
    };

    const result = await getFallbackApisOrExit(undefined, apisConfig);

    expect(process.stderr.write).toHaveBeenCalledTimes(0);
    expect(process.exit).toHaveBeenCalledTimes(0);
    expect(result).toStrictEqual([
      {
        alias: 'main',
        path: 'https://someLinkt/petstore.yaml?main',
      },
    ]);
  });
});

describe('langToExt', () => {
  it.each([
    ['php', '.php'],
    ['c#', '.cs'],
    ['shell', '.sh'],
    ['curl', '.sh'],
    ['bash', '.sh'],
    ['javascript', '.js'],
    ['js', '.js'],
    ['python', '.py'],
  ])('should infer file extension from lang - %s', (lang, expected) => {
    expect(langToExt(lang)).toBe(expected);
  });

  it('should ignore case when inferring file extension', () => {
    expect(langToExt('JavaScript')).toBe('.js');
  });
});

describe('sorTopLevelKeysForOas', () => {
  it('should sort oas3 top level keys', () => {
    const openApi = {
      openapi: '3.0.0',
      components: {},
      security: [],
      tags: [],
      servers: [],
      paths: {},
      info: {},
      externalDocs: {},
      webhooks: [],
      'x-webhooks': [],
      jsonSchemaDialect: '',
    } as any;
    const orderedKeys = [
      'openapi',
      'info',
      'jsonSchemaDialect',
      'servers',
      'security',
      'tags',
      'externalDocs',
      'paths',
      'webhooks',
      'x-webhooks',
      'components',
    ];
    const result = sortTopLevelKeysForOas(openApi);

    Object.keys(result).forEach((key, index) => {
      expect(key).toEqual(orderedKeys[index]);
    });
  });

  it('should sort oas2 top level keys', () => {
    const openApi = {
      swagger: '2.0.0',
      security: [],
      tags: [],
      paths: {},
      info: {},
      externalDocs: {},
      host: '',
      basePath: '',
      securityDefinitions: [],
      schemes: [],
      consumes: [],
      parameters: [],
      produces: [],
      definitions: [],
      responses: [],
    } as any;
    const orderedKeys = [
      'swagger',
      'info',
      'host',
      'basePath',
      'schemes',
      'consumes',
      'produces',
      'security',
      'tags',
      'externalDocs',
      'paths',
      'definitions',
      'parameters',
      'responses',
      'securityDefinitions',
    ];
    const result = sortTopLevelKeysForOas(openApi);

    Object.keys(result).forEach((key, index) => {
      expect(key).toEqual(orderedKeys[index]);
    });
  });
});

describe('handleErrors', () => {
  const ref = 'openapi/test.yaml';

  const redColoretteMocks = red as jest.Mock<any, any>;

  beforeEach(() => {
    jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    jest.spyOn(process, 'exit').mockImplementation((code) => code as never);
    redColoretteMocks.mockImplementation((text) => text);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should handle ResolveError', () => {
    const resolveError = new ResolveError(new Error('File not found'));
    handleError(resolveError, ref);
    expect(redColoretteMocks).toHaveBeenCalledTimes(1);
    expect(process.exit).toHaveBeenCalledWith(1);
    expect(process.stderr.write).toHaveBeenCalledWith(
      `Failed to resolve api definition at openapi/test.yaml:\n\n  - File not found.\n\n`
    );
  });

  it('should handle YamlParseError', () => {
    const yamlParseError = new YamlParseError(new Error('Invalid yaml'), {} as any);
    handleError(yamlParseError, ref);
    expect(redColoretteMocks).toHaveBeenCalledTimes(1);
    expect(process.exit).toHaveBeenCalledWith(1);
    expect(process.stderr.write).toHaveBeenCalledWith(
      `Failed to parse api definition at openapi/test.yaml:\n\n  - Invalid yaml.\n\n`
    );
  });

  it('should handle CircularJSONNotSupportedError', () => {
    const circularError = new CircularJSONNotSupportedError(new Error('Circular json'));
    handleError(circularError, ref);
    expect(process.exit).toHaveBeenCalledWith(1);
    expect(process.stderr.write).toHaveBeenCalledWith(
      `Detected circular reference which can't be converted to JSON.\n` +
        `Try to use ${blue('yaml')} output or remove ${blue('--dereferenced')}.\n\n`
    );
  });

  it('should throw unknown error', () => {
    const testError = new Error('Test error');
    try {
      handleError(testError, ref);
    } catch (e) {
      expect(e).toEqual(testError);
    }
    expect(process.stderr.write).toHaveBeenCalledWith(
      `Something went wrong when processing openapi/test.yaml:\n\n  - Test error.\n\n`
    );
  });
});

describe('checkIfRulesetExist', () => {
  beforeEach(() => {
    jest.spyOn(process, 'exit').mockImplementation((code?: number) => code as never);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should exit if rules not provided', () => {
    const rules = {
      oas2: {},
      oas3_0: {},
      oas3_1: {},
    };
    checkIfRulesetExist(rules);
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('should not exit if rules provided', () => {
    const rules = {
      oas2: { 'operation-4xx-response': 'error' },
      oas3_0: {},
      oas3_1: {},
    } as any;
    checkIfRulesetExist(rules);
    expect(process.exit).not.toHaveBeenCalled();
  });
});
