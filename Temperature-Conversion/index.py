#********************************************************************************
#  Copyright (c) 2018 Edgeworx, Inc.
#
#  This program and the accompanying materials are made available under the
#  terms of the Eclipse Public License v. 2.0 which is available at
#  http://www.eclipse.org/legal/epl-2.0
#
#  SPDX-License-Identifier: EPL-2.0
#********************************************************************************

import json
import threading

from iofog_python_sdk.client import IoFogClient, IoFogException
from iofog_python_sdk.listener import *
from jsonpath_rw import parse

current_config = None
client = IoFogClient()
lock = threading.Lock()
DECIMAL_KELVIN = 'decimal/kelvin'
DECIMAL_CELSIUS = 'decimal/celsius'
DECIMAL_FAHRENHEIT = 'decimal/fahrenheit'
FAHRENHEIT = 'fahrenheit'
CELSIUS = 'celsius'
KELVIN = 'kelvin'
TEMPERATURE = 'temperature'
OUTPUT_FORMAT = 'outputformat'
FIELD_NAME = 'fieldname'

convert_map = {
    DECIMAL_KELVIN: {
        KELVIN: lambda x: x,
        CELSIUS: lambda x: x - 273.15,
        FAHRENHEIT: lambda x: (x * (9. / 5)) - 459.67
    },
    DECIMAL_CELSIUS: {
        KELVIN: lambda x: x + 273.15,
        CELSIUS: lambda x: x,
        FAHRENHEIT: lambda x: (x * x * (9. / 5)) + 32
    },
    DECIMAL_FAHRENHEIT: {
        KELVIN: lambda x: (x + 459.67) * (5. / 9),
        CELSIUS: lambda x: (x - 32) * (5. / 9),
        FAHRENHEIT: lambda x: x
    }
}


def get_path(match):
    if match.context is not None:
        for path_element in get_path(match.context):
            yield path_element
        yield str(match.path)


def update_json(json_obj, path, value):
    try:
        first = next(path)
        # check if item is an array
        if first.startswith('[') and first.endswith(']'):
            try:
                first = int(first[1:-1])
            except ValueError:
                pass
        json_obj[first] = update_json(json_obj[first], path, value)
        return json_obj
    except StopIteration:
        return value


def convert(cur_format, new_format, content_data, field_name):
    content_data_loaded = json.loads(str(content_data))
    if isinstance(content_data_loaded, float) or isinstance(content_data_loaded, int):
        new_value = convert_map[cur_format][new_format](content_data_loaded)
        new_content_data = json.dumps(new_value)
    else:
        pattern = parse(field_name)
        match = pattern.find(content_data_loaded)
        if match:
            cur_value = match[0].value
            new_value = convert_map[cur_format][new_format](cur_value)
            new_content_data = update_json(content_data_loaded, get_path(match[0]), new_value)
            new_content_data = json.dumps(new_content_data)
        else:
            raise Exception('No match found')

    return new_content_data


def build_message(msg_old):
    lock.acquire()
    config = current_config
    lock.release()

    if not config:
        print 'Config is empty...'
        return None

    try:
        if msg_old.infoformat in [DECIMAL_KELVIN, DECIMAL_CELSIUS, DECIMAL_FAHRENHEIT] \
                and msg_old.infotype == TEMPERATURE:
            if OUTPUT_FORMAT in config:
                content_data = convert(msg_old.infoformat, config[OUTPUT_FORMAT],
                                       msg_old.contentdata, config.get(FIELD_NAME))
                msg_old.contentdata = bytearray(content_data)
                msg_old.infoformat = str('decimal/' + config[OUTPUT_FORMAT])
                return msg_old
    except Exception as exc:
        print 'Error building msg: ' + str(exc)

    return None


def update_config():
    attempt_limit = 5
    config = None

    while attempt_limit > 0:
        try:
            config = client.get_config()
            break
        except IoFogException, ex:
            attempt_limit -= 1
            print str(ex)

    if attempt_limit == 0:
        print 'Config update failed :('
        return

    lock.acquire()
    global current_config
    current_config = config
    lock.release()


class ControlListener(IoFogControlWsListener):
    def on_control_signal(self):
        update_config()


class MessageListener(IoFogMessageWsListener):
    def on_receipt(self, message_id, timestamp):
        print 'Receipt: {} {}'.format(message_id, timestamp)

    def on_message(self, io_msg):
        new_msg = build_message(io_msg)
        if new_msg:
            client.post_message_via_socket(new_msg)
        else:
            print 'Message did not pass transformation'


update_config()
client.establish_message_ws_connection(MessageListener())
client.establish_control_ws_connection(ControlListener())
