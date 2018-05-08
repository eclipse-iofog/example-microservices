package org.eclipse.iofog;

import org.eclipse.iofog.api.listener.IOFogAPIListener;
import org.eclipse.iofog.elements.IOMessage;

import javax.json.JsonObject;
import java.util.List;

public class IOFogAPIListenerImpl implements IOFogAPIListener {

    private final JSONSubselectMain mainLogInstance;

    public IOFogAPIListenerImpl(JSONSubselectMain mainLogInstance) {
        this.mainLogInstance = mainLogInstance;
    }

    @Override
    public void onMessages(List<IOMessage> list) {
        //System.out.println("IOFogAPIListenerImpl.onMessages");
        list.forEach(message -> mainLogInstance.buildAndSendMessage(message));
    }

    @Override
    public void onMessagesQuery(long l, long l1, List<IOMessage> list) {
        //System.out.println("IOFogAPIListenerImpl.onMessagesQuery");
        /* do nothing */
    }

    @Override
    public void onError(Throwable throwable) {
        //System.out.println("IOFogAPIListenerImpl.onError");
        System.err.println("Error:" + throwable);
    }

    @Override
    public void onBadRequest(String s) {
        //System.out.println("IOFogAPIListenerImpl.onBadRequest");
        System.err.println("Bad Request: " + s);
    }

    @Override
    public void onMessageReceipt(String s, long l) {
        //System.out.println("IOFogAPIListenerImpl.onMessageReceipt");
        /* do nothing */
    }

    @Override
    public void onNewConfig(JsonObject jsonObject) {
        //System.out.println("IOFogAPIListenerImpl.onNewConfig");
        mainLogInstance.setConfig(jsonObject);
    }

    @Override
    public void onNewConfigSignal() {
        //System.out.println("IOFogAPIListenerImpl.onNewConfigSignal");
        mainLogInstance.updateConfig();
    }

}
