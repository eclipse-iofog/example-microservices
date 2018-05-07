import json
import random
import threading

import time
from iofog_python_sdk.client import IoFogClient, IoFogException
from iofog_python_sdk.iomessage import IoMessage
from iofog_python_sdk.listener import *

current_config = None
client = IoFogClient()
lock = threading.Lock()
MINIMUM_VALUE_X = 'minimumvalueaxisx'
MAXIMUM_VALUE_X = 'maximumvalueaxisx'
MINIMUM_VALUE_Y = 'minimumvalueaxisy'
MAXIMUM_VALUE_Y = 'maximumvalueaxisy'
MINIMUM_VALUE_Z = 'minimumvalueaxisz'
MAXIMUM_VALUE_Z = 'maximumvalueaxisz'
MOTION_X = 'motionx'
MOTION_Y = 'motiony'
MOTION_Z = 'motionz'
SEISMIC_JSON = 'seismic/json'
TEXT_UTF8 = 'text/utf8'
FREQUENCY = 'frequency'
DEFAULT_SLEEP_TIME = 2000
DEFAULT_MINIMUM_VALUE = 0.
DEFAULT_MAXIMUM_VALUE = 100.


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


def simulate_seismic():
    lock.acquire()
    config = current_config
    lock.release()

    if not config:
        print 'Config is empty...'
        return False

    time.sleep(config.get(FREQUENCY, DEFAULT_SLEEP_TIME) / 1000.)
    msg = IoMessage()
    msg.infotype = SEISMIC_JSON
    msg.infoformat = TEXT_UTF8
    contentdata = {
        MOTION_X: random.uniform(config.get(MINIMUM_VALUE_X, DEFAULT_MINIMUM_VALUE),
                                 config.get(MAXIMUM_VALUE_X, DEFAULT_MAXIMUM_VALUE)),
        MOTION_Y: random.uniform(config.get(MINIMUM_VALUE_Y, DEFAULT_MINIMUM_VALUE),
                                 config.get(MAXIMUM_VALUE_Y, DEFAULT_MAXIMUM_VALUE)),
        MOTION_Z: random.uniform(config.get(MINIMUM_VALUE_Z, DEFAULT_MINIMUM_VALUE),
                                 config.get(MAXIMUM_VALUE_Z, DEFAULT_MAXIMUM_VALUE))
    }
    contentdata = json.dumps(contentdata)
    msg.contentdata = bytearray(contentdata)
    client.post_message_via_socket(msg)


class ControlListener(IoFogControlWsListener):
    def on_control_signal(self):
        update_config()


class MessageListener(IoFogMessageWsListener):
    def on_receipt(self, message_id, timestamp):
        print 'Receipt: {} {}'.format(message_id, timestamp)


update_config()
client.establish_message_ws_connection(MessageListener())
client.establish_control_ws_connection(ControlListener())

while True:
    simulate_seismic()
