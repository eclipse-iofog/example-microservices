/********************************************************************************
 * Copyright (c) 2018 Edgeworx, Inc.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0
 *
 * SPDX-License-Identifier: EPL-2.0
 ********************************************************************************/

package main

import (
	"encoding/json"
	"errors"
	"fmt"
	sdk "github.com/ioFog/iofog-go-sdk"
	"log"
	"os"
	"strconv"
	"strings"
	"sync"
)

var (
	logger              = log.New(os.Stderr, "", log.LstdFlags)
	containerConfig     map[string]interface{}
	configMutex         = sync.RWMutex{}
	client, clientError = sdk.NewDefaultIoFogClient()
)

type Config struct {
	Selections []Selection `json:"selections"`
}

type Selection struct {
	InputType    string   `json:"inputtype"`
	InputFormat  string   `json:"inputformat"`
	OutputType   string   `json:"outputtype"`
	OutputFormat string   `json:"outputformat"`
	Outputs      []Output `json:"outputs"`
}

type Output struct {
	SubSelection    string `json:"subselection"`
	OutputJSONArray bool   `json:"outputjsonarray"`
	FieldName       string `json:"fieldname"`
}

func main() {
	if clientError != nil {
		logger.Println(clientError.Error())
		return
	}

	updateConfig()

	go func() {
		confChannel := client.EstablishControlWsConnection(0)
		for {
			select {
			case <-confChannel:
				updateConfig()
			}
		}
	}()

	messageChannel, receiptChannel := client.EstablishMessageWsConnection(0, 0)
	for {
		select {
		case msg := <-messageChannel:
			go func() {
				selected, err := buildMessage(msg)
				if err != nil {
					logger.Println(err.Error())
				} else {
					client.SendMessageViaSocket(selected)
				}
			}()
		case <-receiptChannel:

		}
	}

}

func updateConfig() {
	attemptLimit := 5
	var config map[string]interface{}
	var err error

	for config, err = client.GetConfig(); err != nil && attemptLimit > 0; attemptLimit-- {
		logger.Println(err.Error())
	}

	if attemptLimit == 0 {
		logger.Println("Update config failed")
		return
	}

	configMutex.Lock()
	containerConfig = config
	configMutex.Unlock()
}

func buildMessage(msg *sdk.IoMessage) (*sdk.IoMessage, error) {
	var newMsg *sdk.IoMessage = nil
	config := new(Config)
	configMutex.RLock()
	configBytes, err := json.Marshal(containerConfig)
	configMutex.RUnlock()

	if err != nil {
		return nil, err
	} else if err = json.Unmarshal(configBytes, config); err != nil {
		return nil, err
	}

	for _, selection := range config.Selections {
		if msg.InfoType == selection.InputType && msg.InfoFormat == selection.InputFormat {
			newContentData, err := transformContentData(msg.ContentData, selection.Outputs)
			if err != nil {
				return nil, err
			}
			newMsg = &sdk.IoMessage{
				InfoType:    selection.OutputType,
				InfoFormat:  selection.OutputFormat,
				ContentData: newContentData,
			}
		}
	}

	if newMsg == nil {
		return nil, errors.New("No matched selections for input message found")
	}
	return newMsg, nil
}

func transformContentData(contentData []byte, outputs []Output) (result []byte, e error) {
	oldJsonContentData := make(map[string]interface{})
	newJsonContentData := make(map[string]interface{})
	var curValue interface{}
	var present bool
	err := json.Unmarshal(contentData, &oldJsonContentData)
	if err != nil {
		return nil, err
	}
	defer func() {
		if r := recover(); r != nil {
			e = errors.New(fmt.Sprintf("Panic while subselecting occurred: %v", r))
		}
	}()
	for _, output := range outputs {
		path := strings.Split(output.SubSelection, ".")
		curValue = oldJsonContentData
		for _, p := range path {
			if curValueAsMap, ok := curValue.(map[string]interface{}); ok {
				if curValue, present = curValueAsMap[p]; !present {
					curValue = nil
					break
				}
			} else if curValueAsArray, ok := curValue.([]interface{}); ok {
				indx, err := strconv.ParseInt(p, 10, 0)
				if err != nil {
					return nil, err
				}
				curValue = curValueAsArray[indx]
			}
		}
		if output.OutputJSONArray {
			newJsonContentData[output.FieldName] = []interface{}{curValue}
		} else {
			newJsonContentData[output.FieldName] = curValue
		}
	}
	return json.Marshal(newJsonContentData)
}
