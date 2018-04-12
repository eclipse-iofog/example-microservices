import json
import logging
import os
import socket
import threading
import uuid
import urllib2
import time
import subprocess
from iofog_container_sdk.client import IoFogClient, IoFogException
from iofog_container_sdk.listener import *
from iofog_container_sdk.iomessage import IoMessage

CONTAINER_ID = 'containerid'
TIMESTAMP = 'timestamp'
MESSAGE = 'message'
LOCALHOST = 'localhost'
DIAGNOSTIC_TEST = 'diagnostic/test'
APPLICATION_JSON = 'application/json'
URL = 'url'
REPORT_URL = 'report_url'
COMSAT_LIST = 'comsat_list'
PING_REST_BLUE = 'ping_rb'
PING_LOGGER = 'ping_logger'
INTERVAL = 'interval'
IP = 'ip'
PORT = 'port'
HOST = 'host'
SECURE = 'secure'
HTTP = 'http'
HTTPS = 'https'

TEST_SELFNAME = 'SELFNAME'
TEST_PING = 'PING CHECK'
TEST_PING_WITH_PORT = 'PING WITH PORT CHECK'
TEST_CLIENT_CREATION = 'CLIENT CREATION CHECK'
TEST_HEARTBEAT = 'HEARTBEAT CHECK'
TEST_WEBSOCKETS = 'WEBSOCKETS CHECK'
TEST_GET_CONFIG = 'GET CONFIG CHECK'
TEST_COMSAT = 'COMSAT CHECK'
TEST_REST_BLUE = 'REST BLUE CHECK'
TEST_LOGGER = 'LOGGER CONTAINER CHECK'
MESSAGE_SOCKET = 'MESSAGE SOCKET'
CONTROL_SOCKET = 'CONTROL SOCKET'
PUBLIC_REPORTING = 'PUBLIC REPORTING'

DEFAULT_INTERVAL = 30

logger = logging.getLogger(__name__)
logger.setLevel(10)
ch = logging.StreamHandler()
ch.setLevel(10)
formatter = logging.Formatter('%(levelname)7s [%(asctime)-15s] - %(message)s')
ch.setFormatter(formatter)
logger.addHandler(ch)


class DiagnosticGuru:
    def __init__(self):
        self.public_report_url = None
        self.rest_blue_port = 10500
        self.log_container_port = 10555
        self.interval = None
        self.iofog_client = None
        self.report_format = '[{}] {}'
        self.current_config = None
        self.lock = threading.Lock()
        self.diagnostic_id = 'GEN-' + str(uuid.uuid4()).replace('-', '')
        self.report_draft = {
            CONTAINER_ID: self.diagnostic_id
        }
        self.heartbeat_timer = None
        self.heartbeat_lock = threading.Lock()
        self.comsat_timer = None
        self.comsat_lock = threading.Lock()
        self.rb_timer = None
        self.rb_lock = threading.Lock()
        self.logger_timer = None
        self.logger_lock = threading.Lock()

    def _send_report(self, message):
        self.report_draft[MESSAGE] = message
        self.report_draft[TIMESTAMP] = long(time.time() * 1000)
        try:
            req = urllib2.Request(self.public_report_url, json.dumps(self.report_draft),
                                  {'Content-Type': APPLICATION_JSON})
            urllib2.urlopen(req)
        except urllib2.HTTPError, e:
            self._log(PUBLIC_REPORTING, 'Cannot report to public URL {}: {}'.format(self.public_report_url, e.read()),
                      logging.ERROR, False)
        except urllib2.URLError, e:
            self._log(PUBLIC_REPORTING, 'Cannot report to public URL {}: {}'.format(self.public_report_url, e.reason),
                      logging.ERROR, False)

    def _log(self, test_name, message='', level=logging.INFO, send_report=True):
        log_entry = self.report_format.format(test_name, message)
        logger.log(level, log_entry)
        if send_report and self.public_report_url:
            self._send_report(log_entry)

    def _ping(self, host, test=TEST_PING):
        with open(os.devnull, 'w') as FNULL:
            resp = subprocess.call(['ping', '-c', '3', host], stdout=FNULL, stderr=FNULL)
        if resp:
            self._log(test, '{} ping failed with error code {}'.format(host, resp), logging.ERROR)
        else:
            self._log(test, 'Successfully pinged {}'.format(host))
        return resp == 0

    def _ping_port(self, host, port, description='', test=TEST_PING_WITH_PORT):
        try:
            socket.socket().connect((host, port))
            self._log(test, 'Successfully connected to {}({}, {})'.format(description, host, port))
            return True
        except Exception as e:
            self._log(test,
                      'Error while connecting to {}({}, {}): {}'.format(description, host, port, e), logging.ERROR)
            return False

    def _ping_comsat(self):
        self.lock.acquire()
        config = self.current_config
        self.lock.release()

        if not config:
            self._log(TEST_COMSAT, 'Container config is empty. Aborting...', logging.ERROR)
            return
        comsat_list = config.get(COMSAT_LIST, [])

        with self.comsat_lock:
            for comsat_ip in comsat_list:
                self._ping(comsat_ip, test=TEST_COMSAT)
            if self.interval:
                self.comsat_timer = threading.Timer(self.interval, self._ping_comsat)
                self.comsat_timer.start()

    def _send_heartbeat(self):
        with self.heartbeat_lock:
            self._log(TEST_HEARTBEAT, '----^v----^v----', logging.DEBUG)
            if self.interval:
                self.heartbeat_timer = threading.Timer(self.interval, self._send_heartbeat)
                self.heartbeat_timer.start()

    def _ping_rb(self):
        with self.rb_lock:
            self._ping_port(self.iofog_client.host, self.rest_blue_port, 'RestBlue System Container', TEST_REST_BLUE)
            if self.interval:
                self.rb_timer = threading.Timer(self.interval, self._ping_rb)
                self.rb_timer.start()

    def _ping_logger(self):
        with self.logger_lock:
            self._ping_port(self.iofog_client.host, self.log_container_port, 'Log System Container', TEST_LOGGER)
            if self.interval:
                self.logger_timer = threading.Timer(self.interval, self._ping_logger)
                self.logger_timer.start()

    def test_client_creation(self):
        try:
            self.iofog_client = IoFogClient()
            self.report_draft[CONTAINER_ID] = self.iofog_client.id
            self._log(TEST_CLIENT_CREATION, 'Iofog client created successfully', logging.INFO, False)
        except IoFogException as ex:
            self._log(TEST_CLIENT_CREATION, 'Error while creating iofog client: {}'.format(ex), logging.ERROR, False)

    def test_heartbeat(self):
        self.lock.acquire()
        config = self.current_config
        self.lock.release()

        if not config:
            self._log(TEST_HEARTBEAT, 'Container config is empty. Aborting...', logging.ERROR)
            return

        if REPORT_URL not in config:
            self._log(TEST_HEARTBEAT, 'No report url is specified in config', logging.INFO)
            return

        config = config[REPORT_URL]
        port_part = (':' + str(config[PORT])) if PORT in config else ''
        protocol_part = (HTTPS if config.get(SECURE, False) else HTTP) + '://'

        if HOST in config and self._ping(config[HOST]):
            self.public_report_url = protocol_part + config[HOST] + port_part + config.get(URL, '')
            self._log(TEST_HEARTBEAT, 'Successfully connected to {} for report sending'.format(config[HOST]))
            self._send_heartbeat()
        else:
            self._log(TEST_HEARTBEAT, 'Unable to connect to {} for report sending'.format(config.get(HOST)),
                      logging.WARN)
            if IP in config and self._ping(config[IP]):
                self.public_report_url = protocol_part + config[IP] + port_part + config.get(URL, '')
                self._log(TEST_HEARTBEAT, 'Successfully connected to {} for report sending'.format(config[IP]))
                self._send_heartbeat()
            else:
                self._log(TEST_HEARTBEAT,
                          'Unable to connect to {} for report sending. No reports will be sent in this case'
                          .format(config.get(IP)), logging.ERROR)
                self.public_report_url = None

    def update_config(self):
        if not self.iofog_client:
            self._log(TEST_GET_CONFIG, 'Iofog client is not created. Aborting...', logging.ERROR, False)
            return

        self.heartbeat_lock.acquire()
        if self.heartbeat_timer:
            self.heartbeat_timer.cancel()
        self.heartbeat_lock.release()

        self.rb_lock.acquire()
        if self.rb_timer:
            self.rb_timer.cancel()
        self.rb_lock.release()

        self.comsat_lock.acquire()
        if self.comsat_timer:
            self.comsat_timer.cancel()
        self.comsat_lock.release()

        self.logger_lock.acquire()
        if self.logger_timer:
            self.logger_timer.cancel()
        self.logger_lock.release()

        attempt_limit = 5
        config = None
        while attempt_limit > 0:
            try:
                config = self.iofog_client.get_config()
                break
            except IoFogException, ex:
                attempt_limit -= 1
                self._log(TEST_GET_CONFIG, 'Error while fetching config: {}. Retrying...'.format(ex), logging.WARN)

        if attempt_limit == 0:
            self._log(TEST_GET_CONFIG, 'Config fetch failed', logging.ERROR)
            return

        self.lock.acquire()
        self.current_config = config
        self.lock.release()
        self._log(TEST_GET_CONFIG, 'Successfully fetched config ' + json.dumps(config))

        self.interval = config.get(INTERVAL, DEFAULT_INTERVAL)
        if self.interval < 0:
            self._log(TEST_GET_CONFIG, 'Test interval cannot be below zero. Using default value.',
                      logging.WARN, True)
            self.interval = DEFAULT_INTERVAL
        self._log(TEST_GET_CONFIG, 'Test interval is ' + str(self.interval) + ' seconds')

        self.test_heartbeat()
        if config.get(PING_REST_BLUE, False):
            self._ping_rb()
        if config.get(PING_LOGGER, False):
            self._ping_logger()
        self._ping_comsat()

    def test_websockets(self):
        if not self.iofog_client:
            self._log(TEST_WEBSOCKETS, 'Iofog client is not created. Aborting...', logging.ERROR, False)
            return

        class ControlListener(IoFogControlWsListener):
            def __init__(self, owner):
                IoFogControlWsListener.__init__(self)
                self.owner = owner

            def on_control_signal(self):
                self.owner._log(CONTROL_SOCKET, 'Got control signal from iofog')
                threading.Thread(target=self.owner.update_config).start()

        class MessageListener(IoFogMessageWsListener):
            def __init__(self, owner):
                IoFogMessageWsListener.__init__(self)
                self.owner = owner

            def on_receipt(self, message_id, timestamp):
                self.owner._log(MESSAGE_SOCKET, 'Got receipt from iofog: {} {}'.format(message_id, timestamp))

            def on_message(self, io_msg):
                self.owner._log(MESSAGE_SOCKET, 'Successfully received message, sending response...')
                new_msg = IoMessage()
                new_msg.infotype = DIAGNOSTIC_TEST
                new_msg.infoformat = DIAGNOSTIC_TEST
                new_msg.contentdata = 'Hello from DIAGNOSTIC container!'
                try:
                    self.owner.iofog_client.post_message_via_socket(new_msg)
                    self.owner._log(MESSAGE_SOCKET, 'Successfully sent response')
                except IoFogException as e:
                    self.owner._log(MESSAGE_SOCKET, 'Error while sending message to iofog: {}'.format(e), logging.ERROR)

        self.iofog_client.establish_control_ws_connection(ControlListener(self))
        self.iofog_client.establish_message_ws_connection(MessageListener(self))


guru = DiagnosticGuru()
guru.test_client_creation()
guru.test_websockets()
guru.update_config()
