import { runCli } from 'command-line-interface'
import { Connect } from './commands/connect'
import { Sync } from './commands/sync'
import { Data } from './commands/data'
import { ResetProvider } from './commands/resetProvider'
import { Connections } from './commands/connections'

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async (): Promise<void> => {
    try {

      const RootCommand = {
        name: 'cli',
        description: 'Verida Command Line Interface',
        // @ts-ignore
        optionDefinitions: [],
        // @ts-ignore
        handle ({ getUsage, ancestors }) {
            console.log(getUsage(
                { commandPath: [ ...ancestors ] }
            ));
        },
        subcommands: {
          Connect,
          Sync,
          Data,
          ResetProvider,
          Connections
        },
        handlers: {
          // @ts-ignore
          commandUnknown ({ unknownCommandName, recommendedCommandName, ancestors }) {
            console.log(unknownCommandName, recommendedCommandName, ancestors)
          },
        }
      }

      await runCli({ rootCommand: RootCommand, argv: process.argv });
    } catch (ex: unknown) {
      // eslint-disable-next-line no-console
      console.error({ ex });
    }
  })()