package org.eclipse.iofog;

import org.eclipse.iofog.api.IOFogClient;
import org.eclipse.iofog.elements.IOMessage;
import io.netty.util.internal.StringUtil;

import javax.json.*;
import java.io.StringReader;

/**
 * Main class
 */
public class JSONSubselectMain {

    private static Object fetchConfigLock = new Object();
    private static JsonObject config = null;
    private static String containerId = "";

    private static IOFogClient ioFogClient;
    private static IOFogAPIListenerImpl listener;

    public static void main(String[] args) throws Exception {

        JSONSubselectMain instance = new JSONSubselectMain();

        if (args.length > 0 && args[0].startsWith("--id=")) {
            containerId = args[0].substring(args[0].indexOf('=') + 1);
        } else {
            containerId = System.getenv("SELFNAME");
        }

        if (StringUtil.isNullOrEmpty(containerId)) {
            System.err.println("Container Id is not specified. Please, use --id=XXXX parameter or set the id as SELFNAME=XXXX environment property");
        } else {
            String ioFogHost = System.getProperty("iofog_host", "iofog");
            int ioFogPort = 54321;
            try {
                ioFogPort = Integer.parseInt(System.getProperty("iofog_port", "54321"));
            } catch (Exception e) {
            /* default value 54321 will be used */
            }

            ioFogClient = new IOFogClient(ioFogHost, ioFogPort, containerId);
            listener = new IOFogAPIListenerImpl(instance);

            updateConfig();

            try {
                ioFogClient.openControlWebSocket(listener);
            } catch (Exception e) {
                System.err.println("Unable to open Control WebSocket to ioFog: " + e.getMessage());
            }

            try {
                ioFogClient.openMessageWebSocket(listener);
            } catch (Exception e) {
                System.err.println("Unable to open Message WebSocket to ioFog: " + e.getMessage());
            }
        }
    }

    public void setConfig(JsonObject configObject) {
        config = configObject;
        synchronized (fetchConfigLock) {
            fetchConfigLock.notifyAll();
        }
    }

    public static void updateConfig(){
        config = null;
        try {
            while (config == null) {
                ioFogClient.fetchContainerConfig(listener);
                synchronized (fetchConfigLock) {
                    fetchConfigLock.wait(1000);
                }
            }
        } catch (Exception e) {
            System.err.println("Error fetching config: " + e.getMessage());
        }
    }

    public static void buildAndSendMessage(IOMessage ioMessage) {
        IOMessage tMessage = buildMessage(ioMessage);
        if(tMessage != null) {
            ioFogClient.sendMessageToWebSocket(tMessage);
        } else {
            System.out.println("Message did't pass transformation. Nothing to send.");
        }
    }

    private static IOMessage buildMessage(IOMessage ioMessage) {
        if(config.containsKey("selections")) {
            JsonArray selections  = config.getJsonArray("selections");
            for (JsonValue selection: selections) {
                JsonObject selectionJson = (JsonObject) selection;
                if(selectionJson.containsKey("inputtype") && selectionJson.containsKey("inputformat")) {
                    if (ioMessage.getInfoType().equals(selectionJson.getString("inputtype"))
                            && ioMessage.getInfoFormat().equals(selectionJson.getString("inputformat"))) {
                        IOMessage newIoMessage = new IOMessage();
                        if(selectionJson.containsKey("outputformat")){
                            newIoMessage.setInfoFormat(selectionJson.getString("outputformat"));
                        } else {
                            newIoMessage.setInfoFormat(ioMessage.getInfoFormat());
                        }
                        if(selectionJson.containsKey("outputtype")) {
                            newIoMessage.setInfoType(selectionJson.getString("outputtype"));
                        } else {
                            newIoMessage.setInfoType(ioMessage.getInfoType());
                        }
                        newIoMessage.setPublisher(containerId);
                        newIoMessage.setContentData(buildJsonData(ioMessage.getContentData(), selectionJson));
                        return newIoMessage;
                    }
                }
            }
        }
        return null;
    }

    private static byte[] buildJsonData(byte[] oldContentData, JsonObject selectionJson) {
        JsonReader jsonReader = Json.createReader(new StringReader(new String(oldContentData)));
        JsonObject oldJsonData = jsonReader.readObject();
        jsonReader.close();
        JsonObjectBuilder dataBuilder = Json.createObjectBuilder();
        if (selectionJson.containsKey("outputs")) {
            JsonArray outputs = selectionJson.getJsonArray("outputs");
            for (JsonValue output: outputs) {
                JsonValue value = null;
                JsonObject outputJson = (JsonObject) output;
                String subselection = "";
                String[] subselections = new String[0];
                if(outputJson.containsKey("subselection")) {
                    subselection = outputJson.getString("subselection");
                    subselections = subselection.split("\\.");
                }
                if(oldJsonData.containsKey(subselection)) {
                    value = oldJsonData.get(subselection);
                } else if (subselections.length > 1) {
                    JsonValue subJson = oldJsonData;
                    for (String subSelect: subselections) {
                        JsonObject temp = (JsonObject) subJson;
                        if(temp.containsKey(subSelect)) {
                            subJson = temp.get(subSelect);
                        }
                    }
                    if(!oldContentData.toString().equals(subJson.toString())) {
                        value = subJson;
                    }
                }
                if(outputJson.containsKey("fieldname")) {
                    String field = outputJson.getString("fieldname");
                    dataBuilder.add(field, buildValue(value, outputJson));
                } else {
                    dataBuilder.add(subselection, buildValue(value, outputJson));
                }
            }
        }
        JsonObject result = dataBuilder.build();
        if (result.size() == 0) {
            return "".getBytes();
        } else {
            return result.toString().getBytes();
        }
    }

    private static JsonValue buildValue(JsonValue value, JsonObject outputConfig) {
        if(outputConfig.containsKey("outputjsonarray") && outputConfig.getBoolean("outputjsonarray")) {
            if(value != null) {
                if (value instanceof JsonArray) {
                    return value;
                } else {
                    JsonArrayBuilder arrayBuilder = Json.createArrayBuilder();
                    arrayBuilder.add(value);
                    return arrayBuilder.build();
                }
            } else {
                return Json.createArrayBuilder().build();
            }
        } else {
            return value!=null ? value : JsonValue.NULL;
        }
    }

}
