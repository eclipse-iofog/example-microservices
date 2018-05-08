import json
import threading

from iofog_python_sdk.client import IoFogClient
from iofog_python_sdk.exception import IoFogException
from iofog_python_sdk.iomessage import IoMessage
from iofog_python_sdk.listener import *
from jsonpath_rw import parse

client = IoFogClient()
current_config = None
SELECTIONS = 'selections'
INPUT_TYPE = 'inputtype'
INPUT_FORMAT = 'inputformat'
OUTPUT_TYPE = 'outputtype'
OUTPUT_FORMAT = 'outputformat'
OUTPUTS = 'outputs'
SUBSELECTION = 'subselection'
FIELD_NAME = 'fieldname'
OUTPUT_ARRAY = 'outputjsonarray'
lock = threading.Lock()


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


def transform_content_data(content_data, outputs):
    content_data_json = json.loads(str(content_data))
    new_content_data = {}
    for output in outputs:
        match = parse(output.get(SUBSELECTION, '')).find(content_data_json)
        if match:
            new_content_data[output[FIELD_NAME]] = match[0].value
        else:
            new_content_data[output[FIELD_NAME]] = None

        if output.get(OUTPUT_ARRAY, False):
            new_content_data[output[FIELD_NAME]] = [new_content_data[output[FIELD_NAME]]]

    return json.dumps(new_content_data)


def transform_message(msg):
    lock.acquire()
    config = current_config
    lock.release()

    if not config:
        print 'Config is empty...'
        return None

    new_msg = None
    for selection in config.get(SELECTIONS, []):
        if msg.infotype == selection.get(INPUT_TYPE) and msg.infoformat == selection.get(INPUT_FORMAT):
            content_data = transform_content_data(msg.contentdata, selection.get(OUTPUTS, []))
            new_msg = IoMessage()
            new_msg.infotype = str(selection.get(OUTPUT_TYPE, ''))
            new_msg.infoformat = str(selection.get(OUTPUT_FORMAT, ''))
            new_msg.contentdata = bytearray(content_data)

    return new_msg


def on_message_routine(io_msg):
    new_msg = transform_message(io_msg)
    if new_msg:
        client.post_message_via_socket(new_msg)
    else:
        print 'Message did not pass transformation'


class MyControlListener(IoFogControlWsListener):
    def on_control_signal(self):
        update_config()


class MyMessageListener(IoFogMessageWsListener):
    def on_receipt(self, message_id, timestamp):
        print 'Receipt: {} {}'.format(message_id, timestamp)

    def on_message(self, io_msg):
        on_message_routine(io_msg)
        # threading.Thread(target=on_message_routine, args=(io_msg,)).start()


update_config()
client.establish_message_ws_connection(MyMessageListener())
client.establish_control_ws_connection(MyControlListener())
