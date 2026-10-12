import { OutboxSerializationError, type OutboxCodec } from '../outbox'
import type { DataSourceQueuedMutation } from '../data-source-mutation-types'
import {
  DataSourceMutationUndeliveredError,
  type DataSourceMutationDescriptor,
  type DataSourceOutboxOptions,
} from './types'

/** Private descriptor boundary for a data source's durable outbox. */
export function createDataSourceDescriptorCodec(
  options: DataSourceOutboxOptions | undefined,
): OutboxCodec<DataSourceQueuedMutation, DataSourceMutationDescriptor> {
  return {
    encode(mutation) {
      const descriptor = mutation.descriptor
      if (!descriptor || typeof descriptor.type !== 'string') {
        throw new OutboxSerializationError(
          'Data-source durable outbox mutations require options.descriptor; action closures are not persistable',
        )
      }
      return descriptor
    },
    decode(descriptor) {
      if (!descriptor || typeof descriptor.type !== 'string') {
        throw new OutboxSerializationError(
          'Data-source outbox descriptor must contain a string `type`',
        )
      }
      const executor = options?.executor
      return {
        description: `data-source:${descriptor.type}`,
        descriptor,
        run: executor
          ? () => executor(descriptor)
          : async () => {
              throw new DataSourceMutationUndeliveredError(
                `No outbox executor is configured for descriptor type "${descriptor.type}"`,
              )
            },
      }
    },
  }
}
