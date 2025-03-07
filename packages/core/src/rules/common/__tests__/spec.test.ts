import { outdent } from 'outdent';
import { lintDocument } from '../../../lint';
import { parseYamlToDocument, replaceSourceWithRef, makeConfig } from '../../../../__tests__/utils';
import { BaseResolver } from '../../../resolve';

describe('Oas3 spec', () => {
  it('should report missing schema property', async () => {
    const document = parseYamlToDocument(
      outdent`
      openapi: 3.0.0
      paths:
        '/test':
          get:
            summary: Gets a specific pet
            parameters:
            - name: petId
              in: path
            responses:
              200:
                description: Ok
        `,
      'foobar.yaml'
    );

    const results = await lintDocument({
      externalRefResolver: new BaseResolver(),
      document,
      config: await makeConfig({ spec: 'error' }),
    });

    expect(replaceSourceWithRef(results)).toMatchInlineSnapshot(`
      Array [
        Object {
          "from": undefined,
          "location": Array [
            Object {
              "pointer": "#/",
              "reportOnKey": true,
              "source": "foobar.yaml",
            },
          ],
          "message": "The field \`info\` must be present on this level.",
          "ruleId": "spec",
          "severity": "error",
          "suggest": Array [],
        },
        Object {
          "from": undefined,
          "location": Array [
            Object {
              "pointer": "#/paths/~1test/get/parameters/0",
              "reportOnKey": true,
              "source": "foobar.yaml",
            },
          ],
          "message": "Must contain at least one of the following fields: schema, content.",
          "ruleId": "spec",
          "severity": "error",
          "suggest": Array [],
        },
      ]
    `);
  });

  it('should report with "referenced from"', async () => {
    const document = parseYamlToDocument(
      outdent`
      openapi: 3.0.0
      components:
        requestBodies:
          TestRequestBody:
            content:
              application/json:
                schema:
                  type: object
        schemas:
          TestSchema:
            title: TestSchema
            allOf:
              - $ref: "#/components/requestBodies/TestRequestBody"
        `,
      'foobar.yaml'
    );

    const results = await lintDocument({
      externalRefResolver: new BaseResolver(),
      document,
      config: await makeConfig({ spec: 'error' }),
    });

    expect(replaceSourceWithRef(results)).toMatchInlineSnapshot(`
      Array [
        Object {
          "from": undefined,
          "location": Array [
            Object {
              "pointer": "#/",
              "reportOnKey": true,
              "source": "foobar.yaml",
            },
          ],
          "message": "The field \`paths\` must be present on this level.",
          "ruleId": "spec",
          "severity": "error",
          "suggest": Array [],
        },
        Object {
          "from": undefined,
          "location": Array [
            Object {
              "pointer": "#/",
              "reportOnKey": true,
              "source": "foobar.yaml",
            },
          ],
          "message": "The field \`info\` must be present on this level.",
          "ruleId": "spec",
          "severity": "error",
          "suggest": Array [],
        },
        Object {
          "from": Object {
            "pointer": "#/components/schemas/TestSchema/allOf/0",
            "source": "foobar.yaml",
          },
          "location": Array [
            Object {
              "pointer": "#/components/requestBodies/TestRequestBody/content",
              "reportOnKey": true,
              "source": "foobar.yaml",
            },
          ],
          "message": "Property \`content\` is not expected here.",
          "ruleId": "spec",
          "severity": "error",
          "suggest": Array [],
        },
      ]
    `);
  });

  it('should report on nullable without type', async () => {
    const document = parseYamlToDocument(
      outdent`
      openapi: 3.0.0
      components:
        requestBodies:
          TestRequestBody:
            content:
              application/json:
                schema:
                  nullable: true
        `,
      'foobar.yaml'
    );

    const results = await lintDocument({
      externalRefResolver: new BaseResolver(),
      document,
      config: await makeConfig({ spec: 'error' }),
    });

    expect(replaceSourceWithRef(results)).toMatchInlineSnapshot(`
      Array [
        Object {
          "from": undefined,
          "location": Array [
            Object {
              "pointer": "#/",
              "reportOnKey": true,
              "source": "foobar.yaml",
            },
          ],
          "message": "The field \`paths\` must be present on this level.",
          "ruleId": "spec",
          "severity": "error",
          "suggest": Array [],
        },
        Object {
          "from": undefined,
          "location": Array [
            Object {
              "pointer": "#/",
              "reportOnKey": true,
              "source": "foobar.yaml",
            },
          ],
          "message": "The field \`info\` must be present on this level.",
          "ruleId": "spec",
          "severity": "error",
          "suggest": Array [],
        },
        Object {
          "location": Array [
            Object {
              "pointer": "#/components/requestBodies/TestRequestBody/content/application~1json/schema/nullable",
              "reportOnKey": false,
              "source": "foobar.yaml",
            },
          ],
          "message": "The \`type\` field must be defined when the \`nullable\` field is used.",
          "ruleId": "spec",
          "severity": "error",
          "suggest": Array [],
        },
      ]
    `);
  });

  it('should report on nullable with type defined in allOf', async () => {
    const document = parseYamlToDocument(
      outdent`
      openapi: 3.0.0
      components:
        requestBodies:
          TestRequestBody:
            content:
              application/json:
                schema:
                  nullable: true
                  allOf:
                    - $ref: "#/components/requestBodies/TestSchema"
          schemas:
            TestSchema:
              title: TestSchema
              type: object
        `,
      'foobar.yaml'
    );

    const results = await lintDocument({
      externalRefResolver: new BaseResolver(),
      document,
      config: await makeConfig({ spec: 'error' }),
    });

    expect(replaceSourceWithRef(results)).toMatchInlineSnapshot(`
      Array [
        Object {
          "from": undefined,
          "location": Array [
            Object {
              "pointer": "#/",
              "reportOnKey": true,
              "source": "foobar.yaml",
            },
          ],
          "message": "The field \`paths\` must be present on this level.",
          "ruleId": "spec",
          "severity": "error",
          "suggest": Array [],
        },
        Object {
          "from": undefined,
          "location": Array [
            Object {
              "pointer": "#/",
              "reportOnKey": true,
              "source": "foobar.yaml",
            },
          ],
          "message": "The field \`info\` must be present on this level.",
          "ruleId": "spec",
          "severity": "error",
          "suggest": Array [],
        },
        Object {
          "location": Array [
            Object {
              "pointer": "#/components/requestBodies/TestRequestBody/content/application~1json/schema/nullable",
              "reportOnKey": false,
              "source": "foobar.yaml",
            },
          ],
          "message": "The \`type\` field must be defined when the \`nullable\` field is used.",
          "ruleId": "spec",
          "severity": "error",
          "suggest": Array [],
        },
        Object {
          "from": undefined,
          "location": Array [
            Object {
              "pointer": "#/components/requestBodies/schemas",
              "reportOnKey": true,
              "source": "foobar.yaml",
            },
          ],
          "message": "The field \`content\` must be present on this level.",
          "ruleId": "spec",
          "severity": "error",
          "suggest": Array [],
        },
        Object {
          "from": undefined,
          "location": Array [
            Object {
              "pointer": "#/components/requestBodies/schemas/TestSchema",
              "reportOnKey": true,
              "source": "foobar.yaml",
            },
          ],
          "message": "Property \`TestSchema\` is not expected here.",
          "ruleId": "spec",
          "severity": "error",
          "suggest": Array [],
        },
      ]
    `);
  });

  it('should not report on SpecExtension with additionalProperties', async () => {
    const document = parseYamlToDocument(
      outdent`
      openapi: 3.0.0
      x-foo:
        prop: bar
      `,
      'foobar.yaml'
    );

    const results = await lintDocument({
      externalRefResolver: new BaseResolver(),
      document,
      config: await makeConfig({ spec: 'error' }),
    });

    expect(replaceSourceWithRef(results)).toMatchInlineSnapshot(`
      Array [
        Object {
          "from": undefined,
          "location": Array [
            Object {
              "pointer": "#/",
              "reportOnKey": true,
              "source": "foobar.yaml",
            },
          ],
          "message": "The field \`paths\` must be present on this level.",
          "ruleId": "spec",
          "severity": "error",
          "suggest": Array [],
        },
        Object {
          "from": undefined,
          "location": Array [
            Object {
              "pointer": "#/",
              "reportOnKey": true,
              "source": "foobar.yaml",
            },
          ],
          "message": "The field \`info\` must be present on this level.",
          "ruleId": "spec",
          "severity": "error",
          "suggest": Array [],
        },
      ]
    `);
  });
});

describe('Oas3.1 spec', () => {
  it('should report with "type can be one of the following only"', async () => {
    const document = parseYamlToDocument(
      outdent`
      openapi: 3.1.0
      info:
        version: 1.0.0
        title: Example.com
        description: info,
        license:
          name: Apache 2.0
          url: 'http://www.apache.org/licenses/LICENSE-2.0.html'
      components:
        schemas:
          TestSchema:
            title: TestSchema
            description: Property name's description
            type: test
        `
    );

    const results = await lintDocument({
      externalRefResolver: new BaseResolver(),
      document,
      config: await makeConfig({ spec: 'error' }),
    });

    expect(replaceSourceWithRef(results)).toMatchInlineSnapshot(`
      Array [
        Object {
          "from": undefined,
          "location": Array [
            Object {
              "pointer": "#/components/schemas/TestSchema/type",
              "reportOnKey": false,
              "source": "",
            },
          ],
          "message": "\`type\` can be one of the following only: \\"object\\", \\"array\\", \\"string\\", \\"number\\", \\"integer\\", \\"boolean\\", \\"null\\".",
          "ruleId": "spec",
          "severity": "error",
          "suggest": Array [],
        },
      ]
    `);
  });

  it('should report with unknown type in type`s list', async () => {
    const document = parseYamlToDocument(
      outdent`
      openapi: 3.1.0
      info:
        version: 1.0.0
        title: Example.com
        description: info,
        license:
          name: Apache 2.0
          url: 'http://www.apache.org/licenses/LICENSE-2.0.html'
      components:
        schemas:
          TestSchema:
            title: TestSchema
            description: Property name's description
            type:
              - string
              - foo
        `
    );

    const results = await lintDocument({
      externalRefResolver: new BaseResolver(),
      document,
      config: await makeConfig({ spec: 'error' }),
    });

    expect(replaceSourceWithRef(results)).toMatchInlineSnapshot(`
      Array [
        Object {
          "from": undefined,
          "location": Array [
            Object {
              "pointer": "#/components/schemas/TestSchema/type/1",
              "reportOnKey": false,
              "source": "",
            },
          ],
          "message": "\`type\` can be one of the following only: \\"object\\", \\"array\\", \\"string\\", \\"number\\", \\"integer\\", \\"boolean\\", \\"null\\".",
          "ruleId": "spec",
          "severity": "error",
          "suggest": Array [],
        },
      ]
    `);
  });

  it('should not report about unknown type', async () => {
    const document = parseYamlToDocument(
      outdent`
      openapi: 3.1.0
      info:
        version: 1.0.0
        title: Example.com
        description: info,
        license:
          name: Apache 2.0
          url: 'http://www.apache.org/licenses/LICENSE-2.0.html'
      components:
        schemas:
          TestSchema:
            title: TestSchema
            description: Property name's description
            type: null
        `
    );

    const results = await lintDocument({
      externalRefResolver: new BaseResolver(),
      document,
      config: await makeConfig({ spec: 'error' }),
    });

    expect(replaceSourceWithRef(results)).toMatchInlineSnapshot(`Array []`);
  });

  it('should not report on SpecExtension with additionalProperties', async () => {
    const document = parseYamlToDocument(
      outdent`
      openapi: 3.1.0
      info:
        x-logo:
          url: 'https://redocly.github.io/redoc/example-logo.svg'
          backgroundColor: '#FFFFFF'
          altText: 'Example logo'
      x-foo:
        prop: bar
      `,
      'foobar.yaml'
    );

    const results = await lintDocument({
      externalRefResolver: new BaseResolver(),
      document,
      config: await makeConfig({ spec: 'error' }),
    });

    expect(replaceSourceWithRef(results)).toMatchInlineSnapshot(`
      Array [
        Object {
          "from": undefined,
          "location": Array [
            Object {
              "pointer": "#/",
              "reportOnKey": true,
              "source": "foobar.yaml",
            },
          ],
          "message": "Must contain at least one of the following fields: paths, components, webhooks.",
          "ruleId": "spec",
          "severity": "error",
          "suggest": Array [],
        },
        Object {
          "from": undefined,
          "location": Array [
            Object {
              "pointer": "#/info",
              "reportOnKey": true,
              "source": "foobar.yaml",
            },
          ],
          "message": "The field \`title\` must be present on this level.",
          "ruleId": "spec",
          "severity": "error",
          "suggest": Array [],
        },
        Object {
          "from": undefined,
          "location": Array [
            Object {
              "pointer": "#/info",
              "reportOnKey": true,
              "source": "foobar.yaml",
            },
          ],
          "message": "The field \`version\` must be present on this level.",
          "ruleId": "spec",
          "severity": "error",
          "suggest": Array [],
        },
      ]
    `);
  });
});
