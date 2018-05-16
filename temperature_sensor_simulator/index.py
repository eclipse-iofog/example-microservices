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
import random
import threading
import time
from iofog_python_sdk.client import IoFogClient, IoFogException
from iofog_python_sdk.iomessage import IoMessage
from iofog_python_sdk.listener import *

current_config = None
client = IoFogClient()
lock = threading.Lock()
MINIMUM_VALUE = 'minimumvalue'
MAXIMUM_VALUE = 'maximumvalue'
TEMPERATURE = 'temperature'
DECIMAL_CELSIUS = 'decimal/celsius'
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


def simulate_temperature():
    lock.acquire()
    config = current_config
    lock.release()

    if not config:
        print 'Config is empty...'
        return False

    time.sleep(config.get(FREQUENCY, DEFAULT_SLEEP_TIME) / 1000.)
    msg = IoMessage()
    msg.infotype = TEMPERATURE
    msg.infoformat = DECIMAL_CELSIUS
    contentdata = json.dumps(random.uniform(config.get(MINIMUM_VALUE, DEFAULT_MINIMUM_VALUE),
                                            config.get(MAXIMUM_VALUE, DEFAULT_MAXIMUM_VALUE)))
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
    simulate_temperature()
